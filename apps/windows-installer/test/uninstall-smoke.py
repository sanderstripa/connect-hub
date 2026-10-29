#!/usr/bin/env python3
"""Exercise the shipped shell script against a private filesystem and systemctl stub."""
import os,pathlib,subprocess,tempfile
source=(pathlib.Path(__file__).parent.parent/'uninstall.sh').read_text()
with tempfile.TemporaryDirectory(prefix='connect-hub-uninstall-') as tmp:
 root=pathlib.Path(tmp)
 paths=['/opt/connect-hub','/etc/connect-hub','/var/log/connect-hub','/var/lib/connect-hub-installer','/etc/systemd/system','/usr/local/bin']
 for path in paths:source=source.replace(path,str(root/path.lstrip('/')))
 # The harness owns only temporary files and does not need actual elevation.
 source=source.replace('[[ $EUID == 0 ]] || fail','true')
 script=root/'remove.sh';script.write_text(source)
 bin=root/'bin';bin.mkdir();calls=root/'calls'
 (bin/'systemctl').write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> '+str(calls)+'\n')
 (bin/'systemctl').chmod(0o755)
 for name in ('getent','userdel','groupdel'):
  stub=bin/name;stub.write_text('#!/bin/sh\nexit 2\n');stub.chmod(0o755)
 env={**os.environ,'PATH':str(bin)+os.pathsep+os.environ['PATH']}
 def file(path,body=''):
  p=root/path.lstrip('/');p.parent.mkdir(parents=True,exist_ok=True);p.write_text(body);return p
 def run():return subprocess.run(['bash',str(script)],env=env,capture_output=True,text=True)
 def refused():
  r=run();assert r.returncode!=0,r.stdout;assert not calls.exists(),'Refusal must precede all service mutations'
 marker=file('/etc/connect-hub/.connect-hub-owned')
 release=root/'opt/connect-hub/releases/fixture';release.mkdir(parents=True)
 (release.parent.parent/'current').symlink_to(release,target_is_directory=True)
 unit=file('/etc/systemd/system/connect-hub.service','# foreign\n')
 refused()
 unit.write_text('# Managed by Connect Hub\nExecStart='+str(root/'opt/connect-hub/current/connect-hub')+'\nEnvironment=XUI_DB_FOLDER='+str(root/'etc/connect-hub')+'\nEnvironment=XUI_LOG_FOLDER='+str(root/'var/log/connect-hub')+'\n')
 foreign=file('/etc/systemd/system/connect-hub-cert-renew.service','# foreign\n');refused();foreign.unlink()
 job=file('/var/lib/connect-hub-installer/.connect-hub-owned')
 state=file('/var/lib/connect-hub-installer/job.fixture/state.json','{"state":"running"}');refused();state.write_text('{"state":"complete"}')
 outside=file('/unrelated/keep','foreign data')
 marker.unlink();marker.symlink_to(outside);refused();marker.unlink();marker.write_text('')
 file('/var/log/connect-hub/panel.log','private log')
 file('/usr/local/bin/connect-hub','# Connect Hub modifications\n')
 r=run();assert r.returncode==0,r.stderr;assert 'CH_UNINSTALLED=1' in r.stdout
 for path in ['/opt/connect-hub','/etc/connect-hub','/var/log/connect-hub','/var/lib/connect-hub-installer','/usr/local/bin/connect-hub','/etc/systemd/system/connect-hub.service']:
  assert not (root/path.lstrip('/')).exists(),path
 assert outside.read_text()=='foreign data'
 assert 'stop connect-hub.service' in calls.read_text()
 print('PASS: shipped removal script; foreign unit, active job and symlink refusal; owned files removed and foreign data preserved')
