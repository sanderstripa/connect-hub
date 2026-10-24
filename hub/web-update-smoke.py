#!/usr/bin/env python3
"""Two real version transitions through the original web UI in a disposable VM.

Only GitHub HTTP responses are fixtures. The TLS-verified downloads, checksums,
installed binaries, root service, migrations, restarts and browser are real.
There is no test-only release URL setting in production code.
"""
import hashlib,http.cookiejar,http.server,io,json,os,pathlib,socket,ssl,subprocess,tarfile,tempfile,threading,time,urllib.parse,urllib.request

assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted','Disposable GitHub runner only'
root=pathlib.Path(__file__).resolve().parent.parent
def run(*args,check=True,input=None):return subprocess.run(args,check=check,capture_output=True,text=True,input=input)
def owned_read(path):return run('sudo','cat',path).stdout
credentials=dict(line.split('=',1)for line in owned_read('/etc/connect-hub/initial-access.txt').splitlines())
original_access=owned_read('/etc/connect-hub/initial-access.txt')
original_revision=run('sudo','readlink','-f','/opt/connect-hub/current').stdout.strip()
base=credentials['LOCAL_URL']
certificate=owned_read('/opt/connect-hub/tls/fullchain.pem')
context=ssl.create_default_context(cadata=certificate)
client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=context),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
csrf=None
def api(path,payload=None,json_body=False):
    body=urllib.parse.urlencode(payload).encode() if payload is not None else None
    headers={'X-CSRF-Token':csrf} if csrf else {}
    if json_body:body=json.dumps(payload).encode();headers['Content-Type']='application/json'
    with client.open(urllib.request.Request(base+path,data=body,headers=headers),timeout=10) as response:return json.load(response)
def login():
    global csrf
    for _ in range(120):
        try:
            csrf=api('csrf-token')['obj']
            assert api('login',{'username':credentials['USERNAME'],'password':credentials['PASSWORD']})['success']
            return
        except OSError:time.sleep(.25)
    raise AssertionError('Panel did not become ready')

with tempfile.TemporaryDirectory(prefix='hub-web-upgrade-') as raw:
    temp=pathlib.Path(raw)
    ca=temp/'fixture.crt';key=temp/'fixture.key'
    run('openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Connect Hub disposable release fixture','-addext','basicConstraints=critical,CA:TRUE','-addext','subjectAltName=DNS:api.github.com,DNS:github.com','-keyout',str(key),'-out',str(ca))
    trust='/usr/local/share/ca-certificates/connect-hub-disposable-update-test.crt'
    assert not pathlib.Path(trust).exists()
    run('sudo','cp',str(ca),trust);run('sudo','update-ca-certificates')
    tls=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);tls.load_cert_chain(ca,key)
    archives={};revisions={}
    tags=['v0.1.0-alpha.5-update-test','v0.1.0-alpha.6-update-test']
    original=root/'dist/connect-hub-linux-amd64.tar.gz'
    for tag in tags:
        binary=temp/(tag+'.bin')
        version=tag.removeprefix('v')
        run('go','build','-trimpath','-buildvcs=false','-tags=netgo,osusergo','-ldflags=-s -w -linkmode external -extldflags=-static -X github.com/mhsanaei/3x-ui/v3/internal/config.version='+version,'-o',str(binary),'.')
        assert run(str(binary),'-v').stdout.strip()==version
        revision=hashlib.sha256(tag.encode()).hexdigest()[:40];revisions[tag]=revision
        output=io.BytesIO()
        with tarfile.open(original) as source,tarfile.open(fileobj=output,mode='w:gz') as target:
            for member in source.getmembers():
                stream=source.extractfile(member) if member.isfile() else None
                if member.name=='connect-hub/connect-hub':
                    data=binary.read_bytes();member.size=len(data);stream=io.BytesIO(data)
                elif member.name=='connect-hub/BUILD.json':
                    data=json.dumps({**json.load(stream),'revision':revision}).encode();member.size=len(data);stream=io.BytesIO(data)
                target.addfile(member,stream)
        archives[tag]=output.getvalue()
    active={'tag':tags[0],'bad_checksum':False}
    downloads=[]
    class Proxy(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_CONNECT(self):
            if self.path not in ('api.github.com:443','github.com:443'):
                self.send_error(502);return
            self.send_response(200);self.end_headers()
            self.connection=tls.wrap_socket(self.connection,server_side=True)
            self.rfile=self.connection.makefile('rb');self.wfile=self.connection.makefile('wb')
            self.close_connection=True
            self.handle_one_request()
        def do_GET(self):
            path=urllib.parse.urlparse(self.path).path
            tag=active['tag']
            release=dict(tag_name=tag,prerelease=True,draft=False,assets=[{'name':'SHA256SUMS'},{'name':'connect-hub-linux-amd64.tar.gz'}])
            if path=='/repos/sanderstripa/connect-hub/releases/latest':
                self.send_error(404);return
            if path=='/repos/sanderstripa/connect-hub/releases':data=json.dumps([release]).encode()
            elif path=='/repos/sanderstripa/connect-hub/releases/tags/'+tag:data=json.dumps(release).encode()
            elif path=='/sanderstripa/connect-hub/releases/download/'+tag+'/SHA256SUMS':
                digest='0'*64 if active['bad_checksum'] else hashlib.sha256(archives[tag]).hexdigest()
                data=(digest+'  connect-hub-linux-amd64.tar.gz\n').encode()
            elif path=='/sanderstripa/connect-hub/releases/download/'+tag+'/connect-hub-linux-amd64.tar.gz':
                downloads.append(tag);data=archives[tag]
            else:self.send_error(502,'Unexpected fixture request');return
            self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    proxy=http.server.ThreadingHTTPServer(('127.0.0.1',0),Proxy)
    threading.Thread(target=proxy.serve_forever,daemon=True).start()
    try:
        env=f'HTTPS_PROXY=http://127.0.0.1:{proxy.server_port}\nNO_PROXY=127.0.0.1,localhost\n'
        subprocess.run(['sudo','tee','/etc/connect-hub/panel.env'],input=env,text=True,capture_output=True,check=True)
        run('sudo','systemctl','restart','connect-hub');login()
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        created=api('panel/hub/api/sudoku/inbounds',{'name':'Survives real web upgrades','host':'127.0.0.1','port':port,'aead':'chacha20-poly1305','table':'prefer_ascii'},True)
        assert created['success'];inbound=created['obj']['id']
        device=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices',{'name':'Preserved device'},True)['obj']['id']
        secret=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},True)['obj']['privateKey']
        active['bad_checksum']=True
        failed=api('panel/api/server/updatePanel',{})
        assert failed['success'],failed.get('msg')
        for _ in range(120):
            status=api('panel/api/server/getUpdateStatus')['obj']
            if status['runId']==failed['obj']['runId'] and status['state']=='failed':break
            time.sleep(.25)
        else:raise AssertionError('Corrupt release did not report update failure')
        assert run('sudo','readlink','-f','/opt/connect-hub/current').stdout.strip()==original_revision
        assert api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},True)['obj']['privateKey']==secret
        active['bad_checksum']=False;downloads.clear()
        # Upstream preserves administrator-added assets across real updates,
        # while excluding its regenerable per-inbound runtime configuration.
        run('sudo','tee','/opt/connect-hub/current/bin/own-custom-test.dat',input='Connect Hub custom asset\n')
        run('sudo','ln','-s','own-custom-test.dat','/opt/connect-hub/current/bin/own-custom-link.dat')
        run('sudo','mkdir','-p','/opt/connect-hub/current/bin/mtproto')
        run('sudo','tee','/opt/connect-hub/current/bin/mtproto/orphan-test.toml',input='stale runtime configuration\n')
        print('PASS: wrong release checksum reports failure and preserves installed binary, access and key; retry remains available',flush=True)
        for tag in tags:
            active['tag']=tag
            info=api('panel/api/server/getPanelUpdateInfo')['obj']
            assert info['updateAvailable'] and info['latestVersion']==tag,info
            browser=subprocess.run(['node',str(root/'hub/web-update-browser.mjs')],input=json.dumps({'url':base,'user':credentials['USERNAME'],'password':credentials['PASSWORD'],'version':tag}),capture_output=True,text=True,timeout=240)
            assert browser.returncode==0,browser.stdout+'\n'+browser.stderr
            print(browser.stdout,flush=True)
            login()
            assert run('sudo','readlink','-f','/opt/connect-hub/current').stdout.strip().endswith(revisions[tag])
            assert run('sudo','/opt/connect-hub/current/connect-hub','-v').stdout.strip()==tag.removeprefix('v')
            assert owned_read('/etc/connect-hub/initial-access.txt')==original_access
            assert api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},True)['obj']['privateKey']==secret
            assert run('sudo','systemctl','is-active','connect-hub').stdout.strip()=='active'
            assert run('sudo','find','/opt/connect-hub/backups','-name','connect-hub.db').stdout.strip()
            assert owned_read('/opt/connect-hub/current/bin/own-custom-test.dat')=='Connect Hub custom asset\n'
            assert owned_read('/opt/connect-hub/current/bin/own-custom-link.dat')=='Connect Hub custom asset\n'
            assert run('sudo','test','-e','/opt/connect-hub/current/bin/mtproto/orphan-test.toml',check=False).returncode!=0
        assert downloads==tags,downloads
        print('PASS: two distinct real binaries installed by ordinary web button, changed revisions/versions, preserved login and Sudoku key, retained backups',flush=True)
    finally:
        run('sudo','systemctl','stop','connect-hub',check=False)
        proxy.shutdown();proxy.server_close()
        run('sudo','rm','--',trust);run('sudo','update-ca-certificates')

