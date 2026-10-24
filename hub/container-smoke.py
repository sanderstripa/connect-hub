#!/usr/bin/env python3
"""Start the compose project alongside an occupied default panel port."""
import http.cookiejar,json,pathlib,socket,ssl,subprocess,time,urllib.request,urllib.parse
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
 menu=docker('compose','exec','-T','connect-hub','bash','/usr/local/bin/connect-hub','status')
 assert 'Running' in menu and 'Not Running' not in menu and 'Not Installed' not in menu,menu
 folders=docker('compose','exec','-T','connect-hub','bash','-c','xui_folder="$XUI_MAIN_FOLDER"; running_in_docker=true; source /app/hub/management-overrides.sh; printf "%s\\n" "$XUI_MAIN_FOLDER" "$XUI_BIN_FOLDER"')
 assert folders.splitlines()==['/app','/app/bin'],folders
 cid=docker('compose','ps','-q','connect-hub');inspect=json.loads(docker('inspect',cid))[0]
 assert {'NET_ADMIN','NET_RAW'}<=set(inspect['HostConfig']['CapAdd'] or []) and 'no-new-privileges:true' in inspect['HostConfig']['SecurityOpt']
 jail=docker('compose','exec','-T','connect-hub','fail2ban-client','status','connect-hub-ipl')
 assert 'connect-hub-ipl' in jail
 docker('compose','exec','-T','connect-hub','fail2ban-client','set','connect-hub-ipl','banip','198.51.100.23')
 assert '198.51.100.23' in docker('compose','exec','-T','connect-hub','iptables-save')
 docker('compose','exec','-T','connect-hub','fail2ban-client','set','connect-hub-ipl','unbanip','198.51.100.23')
 assert '198.51.100.23' not in docker('compose','exec','-T','connect-hub','iptables-save')
 assert inspect['HostConfig']['NetworkMode']!='host' and not inspect['HostConfig']['Privileged']
 assert all(m['Type']=='volume' for m in inspect['Mounts']),'host bind mount present'
 print('PASS: container login, management command, upstream IP-limit jail/capabilities, independent volumes and network namespace')
 docker('compose','restart')
 for _ in range(60):
  try:
   assert 'USERNAME='+creds['USERNAME'] in docker('compose','exec','-T','connect-hub','cat','/etc/connect-hub/initial-access.txt');break
  except subprocess.CalledProcessError:time.sleep(.5)
 else:raise AssertionError('container did not restart')
 print('PASS: container restart preserves its own credentials')
 docker('compose','exec','-T','connect-hub','env','CONNECT_HUB_TLS_MODE=selfsigned','CONNECT_HUB_DOMAIN=127.0.0.1','bash','/app/hub/cert.sh')
 certificate=docker('compose','exec','-T','connect-hub','cat','/opt/connect-hub/tls/fullchain.pem')
 docker('compose','up','-d','--force-recreate')
 published=docker('compose','port','connect-hub','2053');host_port=published.rsplit(':',1)[1]
 base=creds['URL'].replace('http://127.0.0.1:2053','https://127.0.0.1:'+host_port)
 client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ssl.create_default_context(cadata=certificate)),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 for _ in range(60):
  try:assert b'Connect Hub' in req('');break
  except OSError:time.sleep(.5)
 else:raise AssertionError('recreated container did not retain working HTTPS')
 token=json.loads(req('csrf-token'))['obj'];assert json.loads(req('login',{'username':creds['USERNAME'],'password':creds['PASSWORD']},token))['success']
 assert 'hub/renew.sh' in docker('compose','exec','-T','connect-hub','cat','/etc/cron.d/connect-hub-cert-renew')
 assert docker('compose','exec','-T','connect-hub','pgrep','-x','cron')
 print('PASS: container recreation retains verified HTTPS, login and certificate-renewal scheduling')
finally:
 existing.close()
 # Stop only this test compose project. Volumes/data are deliberately retained.
 subprocess.run(['docker','compose','down'],cwd=root,check=False)

