#!/usr/bin/env python3
"""Actual public alpha.6 -> next public release using the original update button.

No release/API/download fixtures here. Run only after publication, on a fresh
disposable hosted runner with Chromium installed.
"""
import hashlib,http.cookiejar,http.server,io,json,os,pathlib,runpy,ssl,subprocess,tarfile,tempfile,threading,time,urllib.parse,urllib.request

assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted'
assert not pathlib.Path('/opt/connect-hub').exists()
root=pathlib.Path(__file__).resolve().parent.parent
expected_version=(root/'internal/config/version').read_text().strip()
assert expected_version!='0.1.0-alpha.6','A same-version install is not an upgrade test'
expected_revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
def run(*args,check=True):return subprocess.run(args,check=check,capture_output=True,text=True)
def owned(path):return run('sudo','cat',path).stdout
with tempfile.TemporaryDirectory(prefix='hub-public-alpha6-upgrade-') as raw:
    temp=pathlib.Path(raw)
    request=urllib.request.Request('https://github.com/sanderstripa/connect-hub/releases/download/v0.1.0-alpha.6/connect-hub-linux-amd64.tar.gz',headers={'User-Agent':'Connect-Hub-upgrade-verification'})
    with urllib.request.urlopen(request,timeout=180) as response:data=response.read()
    digest=hashlib.sha256(data).hexdigest()
    assert digest=='61bcfbd74525860b271acef089cd5a389d2e741945bcd5aeb7a54eef2a7d1786'
    archive=temp/'alpha6.tar.gz';archive.write_bytes(data)
    with tarfile.open(fileobj=io.BytesIO(data)) as source:installer=source.extractfile('connect-hub/hub/install.sh').read()
    script=temp/'alpha6-install.sh';script.write_bytes(installer)
    run('sudo','env','CONNECT_HUB_TLS_MODE=selfsigned','CONNECT_HUB_LISTEN=127.0.0.1','CONNECT_HUB_HOST=127.0.0.1','bash',str(script),'--package',str(archive),'--sha256',digest)
    fixture=None
    try:
        assert run('sudo','/opt/connect-hub/current/connect-hub','-v').stdout.strip()=='0.1.0-alpha.6'
        before=owned('/etc/connect-hub/initial-access.txt')
        creds=dict(line.split('=',1)for line in before.splitlines())
        certificate=owned('/opt/connect-hub/tls/fullchain.pem')
        client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ssl.create_default_context(cadata=certificate)),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        csrf=None
        def api(path,payload=None,token=None,json_body=False):
            headers={'X-CSRF-Token':token or csrf} if token or csrf else {}
            body=urllib.parse.urlencode(payload).encode() if payload is not None else None
            if json_body:body=json.dumps(payload).encode();headers['Content-Type']='application/json'
            with client.open(urllib.request.Request(creds['LOCAL_URL']+path,data=body,headers=headers),timeout=15) as response:return json.load(response)
        def login():
            global csrf
            csrf=api('csrf-token')['obj']
            assert api('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']})['success']
        login()
        class Target(http.server.BaseHTTPRequestHandler):
            def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'connect-hub-real-xray')
            def log_message(self,*args):pass
        fixture=http.server.ThreadingHTTPServer(('127.0.0.1',0),Target)
        threading.Thread(target=fixture.serve_forever,daemon=True).start()
        old_core=temp/'previous-client';old_core.write_bytes(pathlib.Path('/opt/connect-hub/current/bin/sudoku-linux-amd64').read_bytes());old_core.chmod(0o755)
        suite=runpy.run_path(str(root/'hub/sudoku-inbounds-smoke.py'))['run']
        inbound,other,device,config,_,_,check=suite(api,csrf,old_core,temp,fixture.server_port,lambda message:print('PASS:',message,flush=True))
        secret=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},csrf,json_body=True)['obj']['privateKey']
        info=api('panel/api/server/getPanelUpdateInfo')['obj']
        assert info['currentVersion']=='0.1.0-alpha.6' and info['latestVersion']=='v'+expected_version and info['updateAvailable'],info
        browser=subprocess.run(['node',str(root/'hub/web-update-browser.mjs')],input=json.dumps({'url':creds['LOCAL_URL'],'user':creds['USERNAME'],'password':creds['PASSWORD'],'version':'v'+expected_version}),capture_output=True,text=True,timeout=240)
        assert browser.returncode==0,browser.stdout+'\n'+browser.stderr
        print(browser.stdout,flush=True)
        login()
        installed=json.loads(owned('/opt/connect-hub/current/BUILD.json'))
        assert installed['revision']==expected_revision,installed['revision']
        assert run('sudo','/opt/connect-hub/current/connect-hub','-v').stdout.strip()==expected_version
        assert owned('/etc/connect-hub/initial-access.txt')==before
        assert api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},csrf,json_body=True)['obj']['privateKey']==secret
        check(config)
        assert run('sudo','find','/opt/connect-hub/backups','-name','connect-hub.db').stdout.strip()
        print('PASS: actual public alpha.6 -> '+expected_version+' via ordinary browser button, exact published revision, same login/key and real post-upgrade Sudoku HTTP',flush=True)
    finally:
        if fixture:fixture.shutdown();fixture.server_close()
        run('sudo','systemctl','stop','connect-hub',check=False)
