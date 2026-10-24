#!/usr/bin/env python3
"""Upgrade the public alpha.2 on a fresh disposable hosted runner."""
import hashlib,http.cookiejar,io,json,os,pathlib,secrets,socket,ssl,subprocess,tarfile,tempfile,time,urllib.parse,urllib.request
assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted'
assert not pathlib.Path('/opt/connect-hub').exists()
root=pathlib.Path(__file__).resolve().parent.parent
def run(*args):return subprocess.run(args,capture_output=True,text=True,check=True)
def access():return dict(line.split('=',1)for line in run('sudo','cat','/etc/connect-hub/initial-access.txt').stdout.splitlines())
def session(creds,certificate=None):
 handlers=[urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())]
 if certificate:handlers.append(urllib.request.HTTPSHandler(context=ssl.create_default_context(cadata=certificate)))
 client=urllib.request.build_opener(*handlers)
 def request(path,payload=None,json_body=False):
  headers={'X-CSRF-Token':csrf}if csrf else {}
  body=urllib.parse.urlencode(payload).encode()if payload is not None else None
  if json_body:headers['Content-Type']='application/json';body=json.dumps(payload).encode()
  with client.open(urllib.request.Request(creds['LOCAL_URL']+path,data=body,headers=headers),timeout=15)as response:return json.load(response)
 csrf=None;csrf=request('csrf-token')['obj'];assert request('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']})['success']
 return request
with tempfile.TemporaryDirectory(prefix='hub-alpha2-upgrade-')as raw:
 temp=pathlib.Path(raw)
 data=urllib.request.urlopen('https://github.com/sanderstripa/connect-hub/releases/download/v0.1.0-alpha.2/connect-hub-linux-amd64.tar.gz',timeout=120).read()
 assert hashlib.sha256(data).hexdigest()=='ba757cce6ded902274f8da904d26007d58659f6317d14006789b1e34a51ae81d'
 archive=temp/'alpha2.tar.gz';archive.write_bytes(data)
 with tarfile.open(fileobj=io.BytesIO(data))as t:installer=t.extractfile('connect-hub/hub/install.sh').read()
 script=temp/'alpha2-install.sh';script.write_bytes(installer)
 run('sudo','env','CONNECT_HUB_LISTEN=127.0.0.1','CONNECT_HUB_HOST=127.0.0.1','bash',str(script),'--package',str(archive),'--sha256',hashlib.sha256(data).hexdigest())
 try:
  before=access();assert before['URL'].startswith('http://');api=session(before)
  with socket.socket()as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  result=api('panel/hub/api/sudoku/inbounds',{'name':'Preserved alpha2 inbound','host':'127.0.0.1','port':port,'aead':'chacha20-poly1305','table':'prefer_ascii'},True);assert result['success'];inbound=result['obj']['id']
  result=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices',{'name':'Preserved phone'},True);assert result['success'];device=result['obj']['id']
  old_key=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},True)['obj']['privateKey']
  # A real user may change access settings after installation; initial-access.txt
  # must not be mistaken for the current database's port/path or password.
  with socket.socket()as s:s.bind(('127.0.0.1',0));custom_port=s.getsockname()[1]
  custom_password=secrets.token_hex(24);custom_path='/custom-alpha2-access/'
  run('sudo','env','XUI_DB_FOLDER=/etc/connect-hub','/opt/connect-hub/current/connect-hub','setting','-username','changed-user','-password',custom_password,'-port',str(custom_port),'-webBasePath',custom_path)
  run('sudo','systemctl','restart','connect-hub')
  current=root/'dist/connect-hub-linux-amd64.tar.gz'
  run('sudo','env','CONNECT_HUB_TLS_MODE=selfsigned','bash',str(root/'hub/install.sh'),'--package',str(current),'--sha256',hashlib.sha256(current.read_bytes()).hexdigest(),'--update')
  after=access();assert after['URL'].startswith('https://')
  for field in ('USERNAME','PASSWORD'):assert after[field]==before[field]
  assert urllib.parse.urlparse(after['URL']).path==custom_path
  assert urllib.parse.urlparse(after['URL']).port==custom_port
  certificate=run('sudo','cat','/opt/connect-hub/tls/fullchain.pem').stdout
  api=session({**after,'USERNAME':'changed-user','PASSWORD':custom_password},certificate)
  listed=api('panel/hub/api/sudoku/inbounds')['obj']
  if not any(i['id']==inbound and i['name']=='Preserved alpha2 inbound'for i in listed):
   print(run('sudo','journalctl','-u','connect-hub','--no-pager','-n','50').stdout,flush=True)
   raise AssertionError('Earlier inbound absent from first authenticated response: '+repr([(i['id'],i['name'])for i in listed]))
  assert api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},True)['obj']['privateKey']==old_key
  assert run('sudo','find','/opt/connect-hub/backups','-name','connect-hub.db').stdout.strip()
  print('PASS: actual public alpha.2 -> updated panel, HTTPS login, same credentials/path/port, inbound/device key and retained backup',flush=True)
 finally:run('sudo','systemctl','stop','connect-hub')

