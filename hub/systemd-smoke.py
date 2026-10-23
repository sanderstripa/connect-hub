#!/usr/bin/env python3
"""Disposable hosted-runner test: real unprivileged service and failed update rollback."""
import hashlib,io,json,pathlib,subprocess,tarfile,tempfile,time
root=pathlib.Path(__file__).resolve().parent.parent
archive=root/'dist/connect-hub-linux-amd64.tar.gz'
def run(*args,check=True):return subprocess.run(args,check=check,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
def install(path,update=False):
 return run('sudo','env','CONNECT_HUB_LISTEN=127.0.0.1','CONNECT_HUB_HOST=127.0.0.1','bash',str(root/'hub/install.sh'),'--package',str(path),'--sha256',hashlib.sha256(path.read_bytes()).hexdigest(),*(['--update']if update else []),check=False)
# Simulate a foreign unit outside /etc: the installer must not shadow it.
foreign=pathlib.Path('/run/systemd/system/connect-hub.service')
assert run('systemctl','show','connect-hub.service','-p','LoadState','--value',check=False).stdout.strip()=='not-found'
with tempfile.NamedTemporaryFile(mode='w',suffix='.service') as unit:
 unit.write('[Service]\nExecStart=/bin/false\n');unit.flush()
 run('sudo','cp',unit.name,str(foreign))
 try:
  run('sudo','systemctl','daemon-reload')
  refused=install(archive);assert refused.returncode!=0
  assert not pathlib.Path('/opt/connect-hub').exists()
  assert run('sudo','cat',str(foreign)).stdout=='[Service]\nExecStart=/bin/false\n'
  print('PASS: foreign vendor/runtime service is refused without replacement',flush=True)
 finally:
  run('sudo','rm','--',str(foreign));run('sudo','systemctl','daemon-reload')
r=install(archive)
if r.returncode:raise AssertionError('systemd installation failed: '+r.stderr)
try:
 assert run('sudo','systemctl','is-active','connect-hub').stdout.strip()=='active'
 assert run('sudo','systemctl','show','connect-hub','-p','User','--value').stdout.strip()=='connect-hub'
 old=run('sudo','readlink','-f','/opt/connect-hub/current').stdout.strip()
 access=run('sudo','cat','/etc/connect-hub/initial-access.txt').stdout
 print('PASS: native systemd service runs as dedicated unprivileged connect-hub account',flush=True)
 with tempfile.TemporaryDirectory(prefix='hub-failed-update-') as td:
  broken=pathlib.Path(td)/'broken.tar.gz'
  with tarfile.open(archive) as source,tarfile.open(broken,'w:gz') as dest:
   for member in source.getmembers():
    stream=source.extractfile(member)if member.isfile()else None
    if member.name=='connect-hub/BUILD.json':
     b=json.dumps({**json.load(stream),'revision':'a'*40}).encode();member.size=len(b);stream=io.BytesIO(b)
    elif member.name=='connect-hub/connect-hub':
     b=b'#!/bin/sh\nexit 42\n';member.size=len(b);member.mode=0o755;stream=io.BytesIO(b)
    dest.addfile(member,stream)
  failed=install(broken,True);assert failed.returncode!=0,'broken update unexpectedly succeeded'
  assert run('sudo','readlink','-f','/opt/connect-hub/current').stdout.strip()==old,'old binary was not restored'
  assert run('sudo','cat','/etc/connect-hub/initial-access.txt').stdout==access,'credentials were not preserved'
  for _ in range(20):
   if run('sudo','systemctl','is-active','connect-hub',check=False).stdout.strip()=='active':break
   time.sleep(.25)
  else:raise AssertionError('old service did not recover')
  assert run('sudo','find','/opt/connect-hub/backups','-type','d','-name','failed-data').stdout.strip(),'failed data was not retained'
  print('PASS: failed real service update restores prior binary/data and retains backup plus failed data',flush=True)
finally:
 run('sudo','systemctl','stop','connect-hub',check=False)
