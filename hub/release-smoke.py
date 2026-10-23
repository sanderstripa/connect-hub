#!/usr/bin/env python3
"""Exact public README command, restricted to a fresh GitHub-hosted runner."""
import http.cookiejar,http.server,json,os,pathlib,runpy,socket,subprocess,tempfile,threading,urllib.parse,urllib.request
assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted','Hosted disposable runner required'
root=pathlib.Path(__file__).resolve().parent.parent
assert not pathlib.Path('/opt/connect-hub').exists(),'Fresh runner required'
occupied=[]
for port in (2053,2096,11111,62789):
 s=socket.socket();s.bind(('127.0.0.1',port));s.listen();occupied.append(s)
command='set -o pipefail; curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash'
r=subprocess.run(['bash','-c',command],capture_output=True,text=True)
assert r.returncode==0,'Public installer failed: '+r.stderr[-6000:]
try:
 raw=subprocess.check_output(['sudo','cat','/etc/connect-hub/initial-access.txt'],text=True)
 creds=dict(line.split('=',1)for line in raw.splitlines());base=creds['URL']
 assert urllib.parse.urlparse(base).hostname=='127.0.0.1' and urllib.parse.urlparse(base).port not in (2053,2096,11111,62789)
 jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(jar))
 def request(path,payload=None,token=None,json_body=False):
  headers={'X-CSRF-Token':token}if token else {}
  body=urllib.parse.urlencode(payload).encode()if payload is not None else None
  if json_body:headers['Content-Type']='application/json';body=json.dumps(payload).encode()
  with client.open(urllib.request.Request(base+path,data=body,headers=headers),timeout=15)as response:return json.load(response)
 csrf=request('csrf-token')['obj'];assert request('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']},csrf)['success']
 state=request('panel/hub/api/status')['obj'];assert state['sudoku']['enabled'] and not state['connectCore']['enabled']
 user=subprocess.check_output(['systemctl','show','connect-hub','-p','User','--value'],text=True).strip();assert user=='connect-hub'
 print('PASS: exact public README command downloads release, verifies checksum, installs unprivileged service and permits authenticated login',flush=True)
 class Fixture(http.server.BaseHTTPRequestHandler):
  def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'connect-hub-real-xray')
  def log_message(self,*args):pass
 fixture=http.server.ThreadingHTTPServer(('127.0.0.1',0),Fixture);threading.Thread(target=fixture.serve_forever,daemon=True).start()
 try:
  with tempfile.TemporaryDirectory(prefix='connect-hub-release-')as td:
   suite=runpy.run_path(str(root/'hub/sudoku-inbounds-smoke.py'))['run']
   suite(request,csrf,pathlib.Path('/opt/connect-hub/current/bin/sudoku-linux-amd64'),td,fixture.server_port,lambda name:print('PASS:',name,flush=True))
 finally:fixture.shutdown()
finally:
 subprocess.run(['sudo','systemctl','stop','connect-hub'],check=False)
 for s in occupied:s.close()
