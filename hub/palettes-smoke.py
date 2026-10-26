#!/usr/bin/env python3
"""Eight palette variants against an extracted release, using disposable state."""
import json,os,pathlib,secrets,socket,subprocess,tempfile,time,urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
package=pathlib.Path(os.environ.get('CONNECT_HUB_TEST_PACKAGE',str(root/'dist/connect-hub')))
output=pathlib.Path(os.environ.get('CONNECT_HUB_THEME_EVIDENCE',str(root/'dist/palette-screenshots')))
output.mkdir(parents=True,exist_ok=True)
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='connect-hub-palettes-') as raw:
 state=pathlib.Path(raw)
 for name in ('db','log','bin','integrations'):(state/name).mkdir()
 env={**os.environ,'XUI_DB_FOLDER':str(state/'db'),'XUI_DB_TYPE':'sqlite','XUI_DB_DSN':'','XUI_LOG_FOLDER':str(state/'log'),'XUI_BIN_FOLDER':str(state/'bin'),'XUI_MAIN_FOLDER':str(state),'CONNECT_HUB_INTEGRATIONS_DIR':str(state/'integrations'),'CONNECT_HUB_SUDOKU':'0'}
 binary=package/'connect-hub';password=secrets.token_hex(24);url=f'http://127.0.0.1:{port}/palette-check/'
 with (state/'panel.log').open('w') as log:
  subprocess.run([str(binary),'setting','-username','palette-check','-password',password,'-port',str(port),'-listenIP','127.0.0.1','-webBasePath','/palette-check/','-parallelTest'],env=env,check=True,stdout=log,stderr=log)
  process=subprocess.Popen([str(binary)],cwd=state,env=env,stdout=log,stderr=log)
  try:
   for _ in range(120):
    if process.poll() is not None:raise RuntimeError('Test panel exited before startup')
    try:urllib.request.build_opener(urllib.request.ProxyHandler({})).open(url,timeout=1).read();break
    except OSError:time.sleep(.25)
   else:raise RuntimeError('Test panel did not start')
   subprocess.run(['node',str(root/'hub/palettes-browser.mjs')],input=json.dumps({'url':url,'user':'palette-check','password':password,'output':str(output)}),env=env,text=True,check=True)
  finally:process.terminate();process.wait(timeout=30)
