#!/usr/bin/env python3
"""Disposable Linux installation/API/Xray/update test. No external service access."""
import hashlib,http.cookiejar,http.server,io,json,os,pathlib,socket,sqlite3,subprocess,tarfile,tempfile,threading,time,urllib.error,urllib.parse,urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
archive=root/'dist/connect-hub-linux-amd64.tar.gz'
report={'checks':[]}
def passed(name):report['checks'].append(name);print('PASS:',name,flush=True)
def port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='connect-hub-ci-') as td:
 td=pathlib.Path(td);prefix=td/'app';data=td/'data';logs=td/'logs'
 env={**os.environ,'CONNECT_HUB_PREFIX':str(prefix),'CONNECT_HUB_DATA':str(data),'CONNECT_HUB_LOGS':str(logs)}
 def install(pkg,update=False,check=True):
  return subprocess.run(['bash',str(root/'hub/install.sh'),'--package',str(pkg),'--sha256',hashlib.sha256(pkg.read_bytes()).hexdigest(),'--no-service']+(['--update']if update else []),env=env,check=check,stdout=subprocess.DEVNULL)
 install(archive);passed('fresh isolated installation')
 assert not (td/'x-ui').exists()
 assert install(archive,check=False).returncode!=0;passed('fresh installer refuses existing state')
 creds=dict(line.split('=',1) for line in (data/'initial-access.txt').read_text().splitlines())
 env.update(XUI_DB_FOLDER=str(data),XUI_LOG_FOLDER=str(logs),XUI_BIN_FOLDER=str(prefix/'current/bin'),XUI_MAIN_FOLDER=str(prefix/'current'),CONNECT_HUB_INTEGRATIONS_DIR=str(data/'integrations'))
 base=creds['URL'];jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(jar))
 def request(path,payload=None,token=None,raw=False):
  headers={}
  if token:headers['X-CSRF-Token']=token
  b=urllib.parse.urlencode(payload).encode() if payload is not None else None
  req=urllib.request.Request(base+path,data=b,headers=headers)
  with client.open(req,timeout=15) as res:
   body=res.read();return body if raw else json.loads(body)
 def launch():
  log=open(td/'panel.log','ab');p=subprocess.Popen([str(prefix/'current/connect-hub')],cwd=prefix/'current',env=env,stdout=log,stderr=log);log.close()
  for _ in range(120):
   try:
    if b'Connect Hub' in request('',raw=True):return p
   except (OSError,urllib.error.URLError):pass
   if p.poll() is not None:raise AssertionError((td/'panel.log').read_text()[-8000:])
   time.sleep(.25)
  p.terminate();raise AssertionError('panel did not start')
 def stop(p):
  p.terminate()
  try:p.wait(timeout=15)
  except subprocess.TimeoutExpired:p.kill();p.wait();raise
 p=launch()
 try:
  csrf=request('csrf-token')['obj'];res=request('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']},csrf);assert res['success'],res
  passed('random initial credentials and CSRF login')
  assert request('panel/api/server/status')['success'];passed('authenticated status API')
  status=request('panel/hub/api/status');assert status['success'] and not status['obj']['sudoku']['enabled'] and not status['obj']['connectCore']['enabled'];passed('integrations disabled by default')
  try:request('panel/hub/api/sudoku/start',{})
  except urllib.error.HTTPError as e:assert e.code==403
  else:raise AssertionError('missing CSRF accepted')
  passed('integration mutations require CSRF')
  assert b'Connect Hub' in request('panel/hub',raw=True);passed('Hub UI route served')
  backup=request('panel/api/server/getDb',raw=True);assert backup.startswith(b'SQLite format 3');passed('database backup API')
  class Fixture(http.server.BaseHTTPRequestHandler):
   def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'connect-hub-real-xray')
   def log_message(self,*args):pass
  fixture=http.server.ThreadingHTTPServer(('127.0.0.1',0),Fixture);threading.Thread(target=fixture.serve_forever,daemon=True).start()
  inbound_port=port()
  inbound={'enable':'true','remark':'Hub CI fixture','listen':'127.0.0.1','port':inbound_port,'protocol':'dokodemo-door','settings':json.dumps({'address':'127.0.0.1','port':fixture.server_port,'network':'tcp'}),'streamSettings':json.dumps({'network':'tcp','security':'none'}),'sniffing':'{"enabled":false}','allocate':'{"strategy":"always","refresh":5,"concurrency":3}','expiryTime':0,'total':0,'up':0,'down':0}
  result=request('panel/api/inbounds/add',inbound,csrf);assert result['success'],result
  items=request('panel/api/inbounds/list')['obj'];created=next(x for x in items if x['remark']=='Hub CI fixture')
  proxy=urllib.request.build_opener(urllib.request.ProxyHandler({}));traffic=False
  for _ in range(40):
   try:
    if b'connect-hub-real-xray' in proxy.open(f'http://127.0.0.1:{inbound_port}/',timeout=2).read():traffic=True;break
   except OSError:time.sleep(.25)
  assert traffic,'real Xray forwarding failed';passed('inbound CRUD and real loopback HTTP through packaged Xray')
  assert request('panel/api/inbounds/del/'+str(created['id']),{},csrf)['success'];fixture.shutdown()
  assert not request('panel/api/server/updatePanel',{},csrf)['success'];passed('upstream web self-update is blocked')
 finally:stop(p)
 initial=(data/'initial-access.txt').read_bytes()
 # Construct a second revision of the same tested package to exercise update
 # and data preservation, rather than downloading an unreviewed remote version.
 updated=td/'updated.tar.gz'
 with tarfile.open(archive) as source,tarfile.open(updated,'w:gz') as dest:
  for member in source.getmembers():
   stream=source.extractfile(member) if member.isfile() else None
   if member.name=='connect-hub/BUILD.json':
    b=json.dumps({**json.load(stream),'revision':'f'*40}).encode();member.size=len(b);stream=io.BytesIO(b)
   dest.addfile(member,stream)
 install(updated,update=True);assert initial==(data/'initial-access.txt').read_bytes();assert list((prefix/'backups').glob('*/data/connect-hub.db'));passed('update preserves credentials and retains complete database backup')
 p=launch()
 try:
  jar.clear();csrf=request('csrf-token')['obj'];assert request('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']},csrf)['success'];passed('login after updated release activation')
 finally:stop(p)
report['result']='passed';(root/'dist/smoke-report.json').write_text(json.dumps(report,indent=2))
