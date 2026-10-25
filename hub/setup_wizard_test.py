import contextlib,importlib.util,io,json,os,pathlib,subprocess,tempfile,types,unittest
from unittest.mock import patch
import system_options as options
spec=importlib.util.spec_from_file_location('connect_setup',pathlib.Path(__file__).with_name('setup-wizard.py'))
wizard=importlib.util.module_from_spec(spec);spec.loader.exec_module(wizard)

class SystemOptions(unittest.TestCase):
    def test_bbr_failure_restores_only_changed_values(self):
        with tempfile.TemporaryDirectory() as raw:
            target=pathlib.Path(raw)/'bbr.conf';calls=[]
            def command(*args):
                calls.append(args)
                if args==('sysctl','-w','net.ipv4.tcp_congestion_control=bbr'):raise subprocess.CalledProcessError(1,args)
                return 'bbr'
            with patch.object(options,'SYSCTL_FILE',target),patch.object(options,'bbr_state',return_value={'available':True,'current':'cubic','qdisc':'fq_codel'}),patch.object(options,'command',side_effect=command):
                with self.assertRaises(subprocess.CalledProcessError):options.enable_bbr(raw)
            self.assertEqual(calls[-1],('sysctl','-w','net.core.default_qdisc=fq_codel'))
            self.assertFalse(target.exists())
    def test_unsupported_bbr_never_writes_sysctl(self):
        with patch.object(options,'bbr_state',return_value={'available':False}),patch.object(options,'command') as command:
            with self.assertRaises(RuntimeError):options.enable_bbr('/unused')
            command.assert_not_called()
    @unittest.skipUnless(os.name=='posix','Linux swap permissions')
    def test_additional_swap_preserves_foreign_swap_and_fstab(self):
        with tempfile.TemporaryDirectory() as raw:
            root=pathlib.Path(raw);folder=root/'own-swap';fstab=root/'fstab';original=b'/foreign/swap none swap sw 0 0\n';fstab.write_bytes(original);calls=[]
            def command(*args):
                calls.append(args)
                if args[0]=='findmnt':return 'ext4'
                if args[0]=='dd':(folder/'swapfile').write_bytes(b'allocated test bytes')
                return ''
            disk=types.SimpleNamespace(total=20*1024**3,free=10*1024**3)
            with patch.object(options,'SWAP_DIRECTORY',folder),patch.object(options,'FSTAB',fstab),patch.object(options.shutil,'disk_usage',return_value=disk),patch.object(options,'command',side_effect=command):
                options.create_swap(1,root/'app')
                with self.assertRaises(RuntimeError):options.create_swap(2,root/'app')
            self.assertTrue(fstab.read_bytes().startswith(original))
            self.assertEqual((folder/'swapfile').stat().st_mode&0o777,0o600)
            self.assertEqual([args for args in calls if args[0]=='swapon'],[('swapon',str(folder/'swapfile'))])
            self.assertFalse(any(args[0]=='swapoff' for args in calls))
    def test_failed_domain_check_returns_to_ip_and_keeps_installation_state(self):
        with tempfile.TemporaryDirectory() as raw:
            root=pathlib.Path(raw);data=root/'data';data.mkdir();(data/'.connect-hub-owned').touch()
            env={'CONNECT_HUB_HOST':'1.2.3.4','CONNECT_HUB_DOMAIN':'wrong.example','CONNECT_HUB_LANGUAGE':'en','CONNECT_HUB_NONINTERACTIVE':'1'}
            with patch.dict(os.environ,env),patch.object(wizard.os,'geteuid',return_value=0,create=True),patch.object(wizard,'hardware',return_value={'cpus':1,'ramGB':1,'diskGB':10,'freeGB':5}),patch.object(wizard,'os_info',return_value={'NAME':'Debian','VERSION_ID':'13'}),patch.object(wizard,'domain_preflight',side_effect=ValueError('DNS mismatch')),patch.object(wizard.sys,'argv',['wizard','--prefix',str(root/'app'),'--data',str(data)]),contextlib.redirect_stdout(io.StringIO()):
                wizard.main()
            state=json.loads((data/'setup.json').read_text())
            self.assertEqual((state['addressMode'],state['domain'],state['host']),('ip','','1.2.3.4'))
    def test_domain_input_rejects_url_and_shell_syntax(self):
        for value in ['https://example.com','example.com:443','a;rm.example','127.0.0.1','example..com']:
            with self.assertRaises(ValueError):wizard.validate_domain(value)

if __name__=='__main__':unittest.main()
