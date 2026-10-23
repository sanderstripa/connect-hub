#!/usr/bin/env python3
"""Disposable Linux installation/API/Xray/update test. No external service access."""
import hashlib,http.cookiejar,http.server,io,json,os,pathlib,runpy,socket,sqlite3,subprocess,tarfile,tempfile,threading,time,urllib.error,urllib.parse,urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
archive=root/'dist/connect-hub-linux-amd64.tar.gz'
report={'checks':[]}
def passed(name):report['checks'].append(name);print('PASS:',name,flush=True)
def port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='connect-hub-ci-') as td:
 td=pathlib.Path(td);prefix=td/'app';data=td/'data';logs=td/'logs'
 env={**os.environ,'CONNECT_HUB_PREFIX':str(prefix),'CONNECT_HUB_DATA':str(data),'CONNECT_HUB_LOGS':str(logs),'CONNECT_HUB_LISTEN':'127.0.0.1','CONNECT_HUB_HOST':'127.0.0.1'}
 def install(pkg,update=False,check=True):
  inherited={**env,'XUI_DB_TYPE':'postgres','XUI_DB_DSN':'host=127.0.0.1 port=1 user=foreign dbname=foreign sslmode=disable connect_timeout=1','XUI_PORT':'2053','XUI_NODE_TOKEN_KEY_FILE':'/foreign-panel/private-key','NODE_TOKEN_ENCRYPTION':'required'}
  return subprocess.run(['bash',str(root/'hub/install.sh'),'--package',str(pkg),'--sha256',hashlib.sha256(pkg.read_bytes()).hexdigest(),'--no-service']+(['--update']if update else []),env=inherited,check=check,stdout=subprocess.DEVNULL)
 # A pre-existing panel can keep port 2053 while Hub chooses another port.
 existing=[]
 for used_port in (2053,2096,11111,62789):
  s=socket.socket();s.bind(('127.0.0.1',used_port));s.listen();existing.append(s)
 logs.mkdir();sentinel=logs/'foreign.log';sentinel.write_text('foreign panel log')
 assert install(archive,check=False).returncode!=0
 assert sentinel.read_text()=='foreign panel log' and not prefix.exists() and not data.exists()
 sentinel.unlink();logs.rmdir();passed('existing foreign log directory is refused without modification')
 install(archive);passed('fresh isolated installation alongside occupied port 2053')
 assert (data/'connect-hub.db').is_file();passed('foreign XUI database/key/port environment is ignored')
 assert not (td/'x-ui').exists()
 assert install(archive,check=False).returncode!=0;passed('fresh installer refuses existing state')
 creds=dict(line.split('=',1) for line in (data/'initial-access.txt').read_text().splitlines())
 # Test-only diagnostics are configured before the core starts, so enabling
 # them does not itself force a restart and mask a live reconciliation bug.
 with sqlite3.connect(data/'connect-hub.db') as db:
  initial_template=json.loads(db.execute("select value from settings where key='xrayTemplateConfig'").fetchone()[0])
  initial_template['log'].update(error=str(td/'xray-core.log'),loglevel='debug')
  db.execute("update settings set value=? where key='xrayTemplateConfig'",(json.dumps(initial_template),))
 env.update(XUI_DB_FOLDER=str(data),XUI_LOG_FOLDER=str(logs),XUI_BIN_FOLDER=str(prefix/'current/bin'),XUI_MAIN_FOLDER=str(prefix/'current'),CONNECT_HUB_INTEGRATIONS_DIR=str(data/'integrations'))
 base=creds['URL'];assert urllib.parse.urlparse(base).port!=2053;passed('independent free panel port');jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(jar))
 def request(path,payload=None,token=None,raw=False,json_body=False):
  headers={}
  if token:headers['X-CSRF-Token']=token
  b=urllib.parse.urlencode(payload).encode() if payload is not None else None
  if json_body:headers['Content-Type']='application/json';b=json.dumps(payload).encode()
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
  assert any(c.name=='connect-hub' for c in jar) and all(c.name!='3x-ui' for c in jar)
  passed('random initial credentials, CSRF login and independent session-cookie name')
  assert request('panel/api/server/status')['success'];passed('authenticated status API')
  # The panel HTTP listener becomes available before its independently starting
  # Xray child. Wait for actual readiness before editing live core routing.
  for _ in range(80):
   status=request('panel/api/server/status')['obj']
   if status['xray']['state']=='running':break
   time.sleep(.25)
  else:raise AssertionError('Xray did not become ready: '+json.dumps(status['xray']))
  status=request('panel/hub/api/status');assert status['success'] and status['obj']['sudoku']['enabled'] and not status['obj']['connectCore']['enabled'];passed('bundled Sudoku ready, experimental Core disabled by default')
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
  # Explicitly allow the local fixture in THIS disposable panel only. The
  # shipped default correctly blocks private destinations and stays unchanged.
  template=json.loads(request('panel/api/xray/',{},csrf)['obj'])['xraySetting']
  for outbound in template['outbounds']:
   if outbound.get('tag')=='direct':outbound.setdefault('settings',{}).pop('finalRules',None)
  template['routing']['rules'].insert(1,{'type':'field','ip':['127.0.0.1/32'],'port':str(fixture.server_port),'outboundTag':'direct'})
  assert request('panel/api/xray/update',{'xraySetting':json.dumps(template),'outboundTestUrl':f'http://127.0.0.1:{fixture.server_port}/'},csrf)['success']
  inbound_port=port()
  inbound={'enable':'true','remark':'Hub CI fixture','listen':'127.0.0.1','port':inbound_port,'protocol':'tunnel','settings':json.dumps({'rewriteAddress':'127.0.0.1','rewritePort':fixture.server_port,'allowedNetwork':'tcp','followRedirect':False,'portMap':{}}),'streamSettings':json.dumps({'network':'tcp','security':'none'}),'sniffing':'{"enabled":false}','allocate':'{"strategy":"always","refresh":5,"concurrency":3}','expiryTime':0,'total':0,'up':0,'down':0}
  result=request('panel/api/inbounds/add',inbound,csrf);assert result['success'],result
  items=request('panel/api/inbounds/list')['obj'];created=next(x for x in items if x['remark']=='Hub CI fixture')
  proxy=urllib.request.build_opener(urllib.request.ProxyHandler({}));traffic=False
  # A runtime add can legitimately fall back to the upstream pending-config
  # reconciliation job, which runs every 30 seconds. Exercise that natural
  # path rather than forcing a restart or failing before its first tick.
  deadline=time.monotonic()+65
  while time.monotonic()<deadline:
   try:
    if b'connect-hub-real-xray' in proxy.open(f'http://127.0.0.1:{inbound_port}/',timeout=2).read():traffic=True;break
   except OSError as error:last_error=str(error);time.sleep(.25)
  if not traffic:
   print('Last HTTP error:',locals().get('last_error'),flush=True)
   if (td/'xray-core.log').exists():print((td/'xray-core.log').read_text()[-16000:],flush=True)
   if (prefix/'current/bin/config.json').exists():print('Persisted core config:',(prefix/'current/bin/config.json').read_text(),flush=True)
   print((td/'panel.log').read_text()[-12000:],flush=True)
   print('Runtime config:',request('panel/api/server/getConfigJson'),flush=True)
   print('Core status:',request('panel/api/server/status')['obj']['xray'],flush=True)
  assert traffic,'real Xray forwarding failed';passed('inbound CRUD and real loopback HTTP through packaged Xray')
  assert request('panel/api/inbounds/del/'+str(created['id']),{},csrf)['success'];fixture.shutdown()
  assert not request('panel/api/server/updatePanel',{},csrf)['success'];passed('upstream web self-update is blocked')
 finally:stop(p)
 # Exercise actual optional engine binaries, while the data plane stays local.
 tools=root/'dist/test-tools';sudoku=tools/'sudoku';control=tools/'connect-control'
 assert sudoku.is_file() and control.is_file(),'prepare-test-engines.py must run before smoke'
 core_dir=td/'core-state'
 subprocess.run([str(control),'init-vps',str(core_dir),f'127.0.0.1:{port()}','https://127.0.0.1:17900'],check=True,stdout=subprocess.DEVNULL)
 core_config=json.loads((core_dir/'control.json').read_text());core_port=port();core_config.update(listen=f'127.0.0.1:{core_port}',enrollment_listen='',owned_tun=False,auto_start=False)
 (core_dir/'control.json').write_text(json.dumps(core_config))
 core_log=open(td/'core.log','wb');core=subprocess.Popen([str(control),'serve',str(core_dir/'control.json')],stdout=core_log,stderr=core_log)
 env.update(CONNECT_HUB_CORE_ALPHA='1',CONNECT_HUB_CORE_URL=f'http://127.0.0.1:{core_port}',CONNECT_HUB_CORE_TOKEN_FILE=str(core_dir/'control-token'),CONNECT_HUB_SUDOKU='1',CONNECT_HUB_SUDOKU_BINARY=str(sudoku),CONNECT_HUB_SUDOKU_SHA256=hashlib.sha256(sudoku.read_bytes()).hexdigest())
 p=launch();sudoku_client=None;fixture=None
 try:
  jar.clear();csrf=request('csrf-token')['obj'];assert request('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']},csrf)['success']
  state=request('panel/hub/api/status')['obj'];assert state['connectCore']['enabled'] and state['connectCore']['status']=='stopped',state
  assert not any(k in state['connectCore'] for k in ('devices','token','private_key'));passed('real Connect Core alpha status, no TUN start or secret export')
  sp=port();profile={'host':'127.0.0.1','port':sp,'aead':'chacha20-poly1305','table':'prefer_ascii'}
  created=request('panel/hub/api/sudoku/create',profile,csrf,json_body=True);assert created['success'],created
  secret=created['obj']['privateKey'];assert secret and secret not in json.dumps(request('panel/hub/api/status'))
  assert request('panel/hub/api/sudoku/start',{},csrf)['success'];passed('real compatible Sudoku Core keygen and managed server launch')
  fixture=http.server.ThreadingHTTPServer(('127.0.0.1',0),Fixture);threading.Thread(target=fixture.serve_forever,daemon=True).start()
  socks_port=port();client_config=td/'sudoku-client.json'
  client_config.write_text(json.dumps({'mode':'client','transport':'tcp','local_port':socks_port,'server_address':f'127.0.0.1:{sp}','key':secret,'aead':'chacha20-poly1305','ascii':'prefer_ascii','padding_min':0,'padding_max':0,'enable_pure_downlink':False,'multiplex':'off','httpmask':{'disable':True,'mode':'auto','tls':False,'host':'','path_root':''},'rule_urls':['global']}))
  sc_log=open(td/'sudoku-client.log','wb');sudoku_client=subprocess.Popen([str(sudoku),'-c',str(client_config)],stdout=sc_log,stderr=sc_log)
  def recv(s,n):
   out=b''
   while len(out)<n:
    piece=s.recv(n-len(out));assert piece,'SOCKS stream closed';out+=piece
   return out
  traffic=False
  for _ in range(40):
   try:
    with socket.create_connection(('127.0.0.1',socks_port),timeout=3) as s:
     s.sendall(b'\x05\x01\x00');assert recv(s,2)==b'\x05\x00'
     s.sendall(b'\x05\x01\x00\x01\x7f\x00\x00\x01'+fixture.server_port.to_bytes(2,'big'));reply=recv(s,4);assert reply[1]==0,reply
     if reply[3]==1:recv(s,6)
     elif reply[3]==4:recv(s,18)
     else:recv(s,recv(s,1)[0]+2)
     s.sendall(b'GET / HTTP/1.0\r\nHost: localhost\r\n\r\n');response=b''
     while True:
      chunk=s.recv(4096)
      if not chunk:break
      response+=chunk
     assert b'connect-hub-real-xray' in response;traffic=True;break
   except (OSError,AssertionError):time.sleep(.25)
  if not traffic:
   print('Sudoku state:',request('panel/hub/api/status')['obj']['sudoku'],flush=True)
   print('Client log:',(td/'sudoku-client.log').read_text().replace(secret,'[redacted]')[-8000:],flush=True)
  assert traffic,'real Sudoku TCP/SOCKS round trip failed';passed('real Sudoku client -> managed server -> loopback HTTP traffic')
  assert request('panel/hub/api/sudoku/stop',{},csrf)['success'];assert not request('panel/hub/api/status')['obj']['sudoku']['running'];passed('managed Sudoku stop leaves Core control plane running')
  assert core.poll() is None
  suite=runpy.run_path(str(root/'hub/sudoku-inbounds-smoke.py'))['run']
  a,b,laptop,laptop_cfg,tablet_cfg,phone_cfg,check=suite(request,csrf,sudoku,td,fixture.server_port,passed)
  stop(p);p=launch();jar.clear();csrf=request('csrf-token')['obj'];assert request('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']},csrf)['success']
  # HTTP is available before the background engine startup finishes.
  for _ in range(80):
   restored=request('panel/hub/api/sudoku/inbounds')['obj']
   if len(restored)==2 and all(v['status']['running'] for v in restored):break
   time.sleep(.25)
  else:raise AssertionError('Sudoku autostart failed: '+json.dumps(restored))
  assert request('panel/hub/api/sudoku/inbounds/'+a+'/devices/'+laptop+'/export',{},csrf,json_body=True)['obj']['config']['key']==laptop_cfg['key']
  check(laptop_cfg);check(tablet_cfg);check(phone_cfg,False);passed('Sudoku inbound autostart, device keys and revocation survive panel restart')
 finally:
  if sudoku_client:stop(sudoku_client)
  if fixture:fixture.shutdown()
  stop(p);stop(core);core_log.close()
 env.pop('CONNECT_HUB_CORE_ALPHA',None);env.pop('CONNECT_HUB_SUDOKU',None)
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
 for s in existing:s.close()
report['result']='passed';(root/'dist/smoke-report.json').write_text(json.dumps(report,indent=2))
