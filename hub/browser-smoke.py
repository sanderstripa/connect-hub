#!/usr/bin/env python3
"""Real browser against a freshly built local panel; no personal data or VPS."""
import hashlib,json,os,pathlib,secrets,socket,subprocess,tempfile,time,urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
package=root/'dist/connect-hub'
def port():
 with socket.socket()as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='hub-browser-')as raw:
 state=pathlib.Path(raw)
 for name in ('db','log','bin','integrations'):(state/name).mkdir()
 sudoku=package/'bin/sudoku-linux-amd64'
 env={**os.environ,'XUI_DB_FOLDER':str(state/'db'),'XUI_DB_TYPE':'sqlite','XUI_DB_DSN':'','XUI_PORT':'','XUI_LOG_FOLDER':str(state/'log'),'XUI_BIN_FOLDER':str(package/'bin'),'XUI_MAIN_FOLDER':str(package),'CONNECT_HUB_INTEGRATIONS_DIR':str(state/'integrations'),'CONNECT_HUB_SUDOKU':'1','CONNECT_HUB_SUDOKU_BINARY':str(sudoku),'CONNECT_HUB_SUDOKU_SHA256':hashlib.sha256(sudoku.read_bytes()).hexdigest()}
 binary=package/'connect-hub';panel_port=port();password=secrets.token_hex(24);base=f'http://127.0.0.1:{panel_port}/browser-test/'
 with (state/'panel.log').open('w')as log:
  subprocess.run([str(binary),'setting','-username','browser','-password',password,'-port',str(panel_port),'-listenIP','127.0.0.1','-webBasePath','/browser-test/','-parallelTest'],env=env,stdout=log,stderr=log,check=True)
  process=subprocess.Popen([str(binary)],cwd=state,env=env,stdout=log,stderr=log)
  try:
   for _ in range(120):
    try:urllib.request.build_opener(urllib.request.ProxyHandler({})).open(base,timeout=1).read();break
    except OSError:time.sleep(.25)
   else:raise RuntimeError('Panel did not start')
   subprocess.run(['node',str(root/'hub/browser-smoke.mjs')],input=json.dumps({'url':base,'user':'browser','password':password,'port':port(),'standardPort':port(),'output':str(root/'dist')}),text=True,check=True)
  finally:process.terminate();process.wait(timeout=30)
