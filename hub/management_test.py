"""Management must never uninstall a shared Fail2ban or another panel's jails."""
import os,pathlib,shutil,subprocess,tempfile,unittest

@unittest.skipUnless(shutil.which('bash'),'bash is required')
class SharedFail2banRemoval(unittest.TestCase):
    def exercise(self,foreign=False,symlink=False):
        with tempfile.TemporaryDirectory(prefix='hub-management-') as raw:
            root=pathlib.Path(raw);configuration=root/'fail2ban'
            for folder in ['filter.d','action.d','jail.d']:(configuration/folder).mkdir(parents=True,exist_ok=True)
            existing=configuration/'jail.d/other-panel.conf';existing.write_text('[other-panel]\nenabled=true\n')
            own=[]
            for folder in ['filter.d','action.d','jail.d']:
                file=configuration/folder/'connect-hub-ipl.conf';file.write_text('# Managed by Connect Hub\n[Definition]\n');own.append(file)
            if foreign:own[0].write_text('pre-existing unowned configuration\n')
            if symlink:
                own[0].unlink();own[0].symlink_to(existing)
            script=root/'management.sh'
            script.write_text(pathlib.Path(__file__).with_name('management-overrides.sh').read_text().replace('/etc/fail2ban',str(configuration)))
            binary=root/'bin';binary.mkdir();calls=root/'calls'
            client=binary/'fail2ban-client';client.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\n');client.chmod(0o755)
            env={**os.environ,'PATH':str(binary)+os.pathsep+os.environ['PATH'],'CALLS':str(calls)}
            invocation='xui_folder=/app; LOGI(){ :; }; LOGE(){ echo "$*" >&2; }; before_show_menu(){ :; }; source "$1"; remove_iplimit'
            result=subprocess.run(['bash','-c',invocation,'management-test',str(script)],input='2\n',capture_output=True,text=True,env=env)
            self.assertEqual(existing.read_text(),'[other-panel]\nenabled=true\n')
            if foreign or symlink:
                self.assertNotEqual(result.returncode,0)
                self.assertTrue(all(file.exists() for file in own))
                self.assertFalse(calls.exists(),'unowned configuration must be refused before stopping any jail')
            else:
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertTrue(all(not file.exists() for file in own))
                self.assertEqual(calls.read_text().splitlines(),['status connect-hub-ipl','stop connect-hub-ipl'])
    def test_remove_only_owned_jail(self):self.exercise()
    def test_refuse_unowned_file(self):self.exercise(foreign=True)
    def test_refuse_symlink(self):self.exercise(symlink=True)

if __name__=='__main__':unittest.main()

