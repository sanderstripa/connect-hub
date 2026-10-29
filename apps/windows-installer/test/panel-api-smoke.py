"""Run the desktop bridge against an isolated real packaged Connect Hub panel.
Usage: python3 test/panel-api-smoke.py /absolute/path/to/panel.tar.gz
Never installs a service or modifies host TCP/swap/firewall settings.
"""
import importlib.util,json,os,pathlib,socket,subprocess,sys,tempfile,time,hashlib
root=pathlib.Path(__file__).resolve().parents[3]
base=root/'apps/windows-installer'
def settings(row):return json.loads(row['settings']) if isinstance(row['settings'],str) else row['settings']
spec=importlib.util.spec_from_file_location('desktop_bridge',base/'panel-api.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
pkg=pathlib.Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='connect-desktop-proof-',dir=pkg.parent) as temp:
 td=pathlib.Path(temp);data=td/'data';prefix=td/'app';logs=td/'logs'
 env={**os.environ,'CONNECT_HUB_PREFIX':str(prefix),'CONNECT_HUB_DATA':str(data),'CONNECT_HUB_LOGS':str(logs),'CONNECT_HUB_LISTEN':'127.0.0.1','CONNECT_HUB_HOST':'127.0.0.1'}
 with (td/'proof.log').open('w') as log:
  subprocess.run(['bash',str(root/'hub/install.sh'),'--package',str(pkg),'--sha256',hashlib.sha256(pkg.read_bytes()).hexdigest(),'--no-service'],env=env,stdout=log,stderr=log,check=True)
  access=dict(line.split('=',1) for line in (data/'initial-access.txt').read_text().splitlines() if '=' in line)
  env.update(XUI_DB_FOLDER=str(data),XUI_LOG_FOLDER=str(logs),XUI_BIN_FOLDER=str(prefix/'current/bin'),XUI_MAIN_FOLDER=str(prefix/'current'),CONNECT_HUB_INTEGRATIONS_DIR=str(data/'integrations'))
  proc=subprocess.Popen([str(prefix/'current/connect-hub')],cwd=prefix/'current',env=env,stdout=log,stderr=log)
  try:
   for _ in range(80):
    try:panel=bridge.Panel(access);break
    except bridge.PanelError:time.sleep(.25)
   else:raise AssertionError('isolated panel failed to start')
   assert panel.run({'action':'list'})==[]
   keys=panel.run({'action':'keys'});assert keys['privateKey'] and keys['publicKey']
   # Reserve a contiguous port range for the actual native listeners.
   first=31000
   while True:
    sockets=[]
    try:
     for port in range(first,first+5):
      s=socket.socket();s.bind(('0.0.0.0',port));sockets.append(s)
     break
    except OSError:first+=5
    finally:
     for s in sockets:s.close()
   script="const c=require('./connections.cjs');const s=c.selection(JSON.parse(process.argv[1]));console.log(JSON.stringify(s.protocols.map((p,i)=>c.preset(p,s,s.port+i,JSON.parse(process.argv[2])))));"
   selected={'name':'Desktop proof','host':'203.0.113.10','port':first,'protocols':['vless','xhttp','sudoku','mtproto','shadowsocks']}
   inbounds=json.loads(subprocess.check_output(['node','-e',script,json.dumps(selected),json.dumps(keys)],cwd=base))
   for inbound in inbounds:
    try:panel.run({'action':'create','inbound':inbound})
    except Exception:
     print('FAILED protocol',inbound['protocol'],flush=True);raise
   rows=panel.run({'action':'list'});assert len(rows)==5
   sudo=next(row for row in rows if row['protocol']=='sudoku')
   assert settings(sudo)['clients'][0]['sudokuKey']
   encoded=json.dumps(rows)
   export="const c=require('./connections.cjs');let b='';process.stdin.on('data',x=>b+=x);process.stdin.on('end',()=>{const r=c.exportRows(JSON.parse(b),'203.0.113.10');if(r.length!==5||r.some(x=>!x.url))process.exit(1);console.log('PASS: all five real panel client links exported');});"
   subprocess.run(['node','-e',export],input=encoded,text=True,cwd=base,check=True)
   # The upstream core applies pending configurations on its timer.
   listening=set()
   for _ in range(60):
    for port in range(first,first+5):
     try:
      with socket.create_connection(('127.0.0.1',port),timeout=.2):listening.add(port)
     except OSError:pass
    if len(listening)==5:break
    time.sleep(.5)
   assert len(listening)==5, f'Only {len(listening)}/5 native listeners active'
   again=bridge.Panel(access).run({'action':'list'})
   assert settings(next(x for x in again if x['protocol']=='sudoku'))['clients'][0]['sudokuKey']==settings(sudo)['clients'][0]['sudokuKey']
   try:panel.run({'action':'create','inbound':inbounds[0]})
   except bridge.PanelError as exc:assert str(exc)=='PORT_IN_USE'
   else:raise AssertionError('busy port accepted')
   print('PASS: real CSRF/login API, 5 presets, generated Sudoku key, 5 listeners, reconnect and busy port refusal',flush=True)
  except Exception:
   print((td/'proof.log').read_text()[-5000:]);raise
  finally:
   proc.terminate()
   try:proc.wait(timeout=15)
   except subprocess.TimeoutExpired:proc.kill();proc.wait()
