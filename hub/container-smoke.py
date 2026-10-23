#!/usr/bin/env python3
"""Start the compose project alongside an occupied default panel port."""
import http.cookiejar,json,pathlib,socket,subprocess,time,urllib.request,urllib.parse
root=pathlib.Path(__file__).resolve().parent.parent
def docker(*args):return subprocess.check_output(['docker',*args],cwd=root,text=True).strip()
existing=socket.socket();existing.bind(('127.0.0.1',2053));existing.listen()
try:
 docker('compose','up','-d')
 creds=None
 for _ in range(120):
  try:
   text=docker('compose','exec','-T','connect-hub','cat','/etc/connect-hub/initial-access.txt');creds=dict(line.split('=',1)for line in text.splitlines());break
  except subprocess.CalledProcessError:time.sleep(.5)
 assert creds,'container did not initialize'
 published=docker('compose','port','connect-hub','2053');assert published.startswith('127.0.0.1:') and not published.endswith(':2053')
 host_port=published.rsplit(':',1)[1];base=creds['URL'].replace('127.0.0.1:2053','127.0.0.1:'+host_port)
 jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(jar))
 def req(path,payload=None,csrf=None):
  headers={'X-CSRF-Token':csrf}if csrf else {};body=urllib.parse.urlencode(payload).encode()if payload is not None else None
  with client.open(urllib.request.Request(base+path,data=body,headers=headers),timeout=10)as r:return r.read()
 assert b'Connect Hub' in req('')
 token=json.loads(req('csrf-token'))['obj'];assert json.loads(req('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']},token))['success']
 state=json.loads(req('panel/hub/api/status'))['obj'];assert state['sudoku']['enabled'] and not state['connectCore']['enabled']
 cid=docker('compose','ps','-q','connect-hub');inspect=json.loads(docker('inspect',cid))[0]
 assert inspect['HostConfig']['CapDrop']==['ALL'] and 'no-new-privileges:true' in inspect['HostConfig']['SecurityOpt']
 assert inspect['HostConfig']['NetworkMode']!='host' and not inspect['HostConfig']['Privileged']
 assert all(m['Type']=='volume' for m in inspect['Mounts']),'host bind mount present'
 print('PASS: container login, disabled integrations, free loopback port, independent volumes, no privileges or host networking')
 docker('compose','restart')
 for _ in range(60):
  try:
   assert 'USERNAME='+creds['USERNAME'] in docker('compose','exec','-T','connect-hub','cat','/etc/connect-hub/initial-access.txt');break
  except subprocess.CalledProcessError:time.sleep(.5)
 else:raise AssertionError('container did not restart')
 print('PASS: container restart preserves its own credentials')
finally:
 existing.close()
 # Stop only this test compose project. Volumes/data are deliberately retained.
 subprocess.run(['docker','compose','down'],cwd=root,check=False)
