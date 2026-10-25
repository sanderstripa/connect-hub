"""Execute the copy/paste bootstrap with absent/present downloaders and root/sudo."""
import os,pathlib,shutil,subprocess,tempfile,unittest

@unittest.skipUnless(os.name=='posix' and pathlib.Path('/bin/bash').exists(),'POSIX bootstrap')
class BootstrapCommand(unittest.TestCase):
    def exercise(self,downloader,uid='0',fail=False):
        with tempfile.TemporaryDirectory(prefix='hub-bootstrap-test-') as raw:
            root=pathlib.Path(raw);binary=root/'bin';binary.mkdir();calls=root/'calls';certificate=root/'ca.crt';certificate.write_text('fixture CA')
            for name in ['sh','mktemp','rm','cat','cp','chmod']:(binary/name).symlink_to(shutil.which(name))
            def executable(name,body):
                path=binary/name;path.write_text('#!/bin/sh\n'+body);path.chmod(0o755);return path
            executable('id','echo '+uid+'\n')
            executable('sudo','echo "sudo $*" >> "$CALLS"\nexec "$@"\n')
            executable('bash','echo bash >> "$CALLS"\nexec /bin/bash "$@"\n')
            curl_body='echo curl >> "$CALLS"\n'+('exit 23\n' if fail else 'while [ "$#" -gt 0 ]; do case "$1" in -o) dest=$2;shift 2;;*) shift;;esac;done\nprintf "echo BOOTSTRAP_LOADED\\n" > "$dest"\n')
            staged=root/'curl';staged.write_text('#!/bin/sh\n'+curl_body);staged.chmod(0o755)
            executable('apt-get','echo "apt $*" >> "$CALLS"\nif [ "$1" = install ]; then cp "$STAGED_CURL" "$TEST_BIN/curl";chmod +x "$TEST_BIN/curl";fi\n')
            if downloader=='curl':shutil.copy2(staged,binary/'curl')
            if downloader=='wget':executable('wget','echo wget >> "$CALLS"\nprintf "echo BOOTSTRAP_LOADED\\n" > "$2"\n')
            command=pathlib.Path(__file__).with_name('INSTALL-COMMAND.txt').read_text().replace('/etc/ssl/certs/ca-certificates.crt',str(certificate))
            env={**os.environ,'PATH':str(binary),'CALLS':str(calls),'STAGED_CURL':str(staged),'TEST_BIN':str(binary),'TMPDIR':str(root)}
            result=subprocess.run(['/bin/sh','-c',command],env=env,capture_output=True,text=True)
            events=calls.read_text().splitlines()
            if fail:self.assertNotEqual(result.returncode,0);self.assertNotIn('bash',events);return
            self.assertEqual(result.returncode,0,result.stderr);self.assertIn('BOOTSTRAP_LOADED',result.stdout)
            self.assertEqual(events[-1],'bash')
            if downloader is None:
                self.assertIn('apt update',events);self.assertIn('apt install -y curl ca-certificates',events)
                self.assertEqual(any(row.startswith('sudo ') for row in events),uid!='0')
            else:self.assertFalse(any(row.startswith('apt ') for row in events))
    def test_existing_curl(self):self.exercise('curl')
    def test_debian_with_wget_and_no_curl(self):self.exercise('wget')
    def test_no_downloader_root_without_sudo(self):self.exercise(None)
    def test_no_downloader_sudo_account(self):self.exercise(None,'1001')
    def test_failed_download_never_runs_empty_installer(self):self.exercise('curl',fail=True)

if __name__=='__main__':unittest.main()
