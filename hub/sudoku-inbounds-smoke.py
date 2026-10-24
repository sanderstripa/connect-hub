"""Real compatible Core: independent inbounds, per-device credentials and revocation."""
import json,os,pathlib,socket,subprocess,tempfile,threading,time

def run(request,csrf,core,td,fixture_port,passed):
 base='panel/hub/api/sudoku/inbounds'
 def api(path,payload=None):
  r=request(base+path,payload or {},csrf,json_body=True)
  assert r['success'],r
  return r.get('obj')
 def port():
  with socket.socket()as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
 def inbound(name):return api('',{'name':name,'host':'127.0.0.1','port':port(),'aead':'chacha20-poly1305','table':'prefer_ascii'})['id']
 a=inbound('Office');b=inbound('Home')
 def device(i,n):
  d=api('/'+i+'/devices',{'name':n})
  return d['id'],api('/'+i+'/devices/'+d['id']+'/export')['config']
 phone,phone_cfg=device(a,'Phone');laptop,laptop_cfg=device(a,'Laptop');tablet,tablet_cfg=device(b,'Tablet')
 assert len({c['key']for c in (phone_cfg,laptop_cfg,tablet_cfg)})==3
 listed=json.dumps(request(base)['obj'])
 assert all(c['key']not in listed for c in (phone_cfg,laptop_cfg,tablet_cfg))
 for i in (a,b):api('/'+i+'/start')
 def check(config,expected=True,udp=False):
  cfg={**config,'local_port':port()};directory=pathlib.Path(tempfile.mkdtemp(prefix='sudoku-client-',dir=td));path=directory/'client.json';path.write_text(json.dumps(cfg))
  env={**os.environ,'SUDOKU_STATS_PATH':str(directory/'stats.json'),'SUDOKU_POLICY_PATH':str(directory/'policy.json'),'SUDOKU_CONTROL_SOCKET':str(directory/'control.sock')}
  log=(directory/'client.log').open('wb');p=subprocess.Popen([str(core),'-c',str(path)],cwd=directory,env=env,stdout=log,stderr=log)
  def recv(s,n):
   out=b''
   while len(out)<n:
    part=s.recv(n-len(out))
    if not part:raise OSError('SOCKS stream closed')
    out+=part
   return out
  try:
   for _ in range(80):
    try:s=socket.create_connection(('127.0.0.1',cfg['local_port']),timeout=.1);s.close();break
    except OSError:time.sleep(.05)
   else:raise AssertionError('client did not start')
   ok=False
   try:
    with socket.create_connection(('127.0.0.1',cfg['local_port']),timeout=4)as s:
     s.sendall(b'\x05\x01\x00');assert recv(s,2)==b'\x05\x00'
     s.sendall((b'\x05\x03\x00\x01\x00\x00\x00\x00\x00\x00' if udp else b'\x05\x01\x00\x01\x7f\x00\x00\x01'+fixture_port.to_bytes(2,'big')))
     reply=recv(s,4)
     if reply[1]!=0:raise OSError('SOCKS refused')
     if reply[3]==1:bound=recv(s,6)
     elif reply[3]==4:bound=recv(s,18)
     else:bound=recv(s,recv(s,1)[0]+2)
     if udp:
      with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as echo,socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as datagram:
       echo.bind(('127.0.0.1',0));echo.settimeout(5);datagram.settimeout(4)
       def respond():
        try:
         payload,peer=echo.recvfrom(4096);echo.sendto(payload,peer)
        except OSError:pass
       thread=threading.Thread(target=respond,daemon=True);thread.start()
       message=b'connect-hub-sudoku-udp-roundtrip'
       packet=b'\x00\x00\x00\x01\x7f\x00\x00\x01'+echo.getsockname()[1].to_bytes(2,'big')+message
       relay=socket.inet_ntoa(bound[:4]) if reply[3]==1 else '127.0.0.1'
       if relay=='0.0.0.0':relay='127.0.0.1'
       datagram.sendto(packet,(relay,int.from_bytes(bound[-2:],'big')))
       response,_=datagram.recvfrom(4096)
       ok=response[:4]==b'\x00\x00\x00\x01' and response[10:]==message
     else:
      s.sendall(b'GET / HTTP/1.0\r\nHost: localhost\r\n\r\n');response=b''
      while True:
       part=s.recv(4096)
       if not part:break
       response+=part
      ok=b'connect-hub-real-xray'in response
   except OSError:pass
   assert ok==expected,'device traffic result: '+str(ok)+' expected '+str(expected)
  finally:
   p.terminate()
   try:p.wait(timeout=8)
   except subprocess.TimeoutExpired:p.kill();p.wait()
   log.close()
 for cfg in (phone_cfg,laptop_cfg,tablet_cfg):check(cfg)
 passed('two independent Sudoku inbounds and three distinct real device keys forward HTTP')
 check(phone_cfg,udp=True);check(tablet_cfg,udp=True)
 passed('real SOCKS UDP ASSOCIATE forwards datagrams through both native Sudoku inbounds')
 check({**phone_cfg,'server_address':tablet_cfg['server_address']},False)
 passed('device key cannot authenticate to another Sudoku inbound')
 api('/'+a+'/devices/'+phone+'/disabled');check(phone_cfg,False);check(laptop_cfg);check(tablet_cfg)
 api('/'+a+'/devices/'+phone+'/enabled');check(phone_cfg)
 api('/'+a+'/devices/'+phone+'/revoked');check(phone_cfg,False);check(laptop_cfg);check(tablet_cfg)
 assert not request(base+'/'+a+'/devices/'+phone+'/enabled',{},csrf,json_body=True)['success']
 passed('per-device disable, enable and permanent revoke preserve other device and inbound access')
 check(phone_cfg,False,udp=True);check(laptop_cfg,udp=True)
 passed('revoked Sudoku device cannot forward UDP while another device still can')
 return a,b,laptop,laptop_cfg,tablet_cfg,phone_cfg,check

