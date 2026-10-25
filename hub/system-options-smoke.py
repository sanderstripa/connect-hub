#!/usr/bin/env python3
"""Exercise selected tuning only on a disposable GitHub VM; restore prior state."""
import os,pathlib,subprocess,tempfile
import system_options as options
assert os.geteuid()==0 and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted'
assert not options.SYSCTL_FILE.exists() and not options.SWAP_DIRECTORY.exists()
def swap_entries():return [tuple(row.split()[:3]+row.split()[4:]) for row in pathlib.Path('/proc/swaps').read_text().splitlines()[1:]]
before_swap=swap_entries()
before_fstab=options.FSTAB.read_bytes()
with tempfile.TemporaryDirectory(prefix='hub-system-options-') as raw:
    before_bbr=options.bbr_state()
    try:
        if before_bbr['available']:
            result=options.enable_bbr(raw)
            assert options.command('sysctl','-n','net.ipv4.tcp_congestion_control')=='bbr'
            if result!='already-enabled':assert options.SYSCTL_FILE.read_text().startswith('# Managed by Connect Hub')
            print('PASS: real supported BBR activation and persistence, without a kernel replacement/reboot',flush=True)
        else:print('SKIP: this disposable kernel does not provide BBR; unsupported handling is unit-tested',flush=True)
        try:target=options.create_swap(1,raw)
        except subprocess.CalledProcessError as error:
            assert not options.SWAP_DIRECTORY.joinpath('swapfile').exists()
            assert options.FSTAB.read_bytes()==before_fstab
            if 'not permitted' in (error.stderr or '').lower():print('SKIP: runner forbids swapon; failure cleaned only its own partial file',flush=True)
            else:raise
        else:
            after=swap_entries()
            assert all(line in after for line in before_swap) and any(line[0]==target for line in after)
            assert pathlib.Path(target).stat().st_mode&0o777==0o600
            assert options.FSTAB.read_bytes().startswith(before_fstab)
            print('PASS: real additional 1 GB swap is active; pre-existing swap and fstab entries retained',flush=True)
    finally:
        options.command('sysctl','-w','net.ipv4.tcp_congestion_control='+before_bbr['current'])
        options.command('sysctl','-w','net.core.default_qdisc='+before_bbr['qdisc'])
        if options.SYSCTL_FILE.exists():
            assert options.SYSCTL_FILE.read_text().startswith('# Managed by Connect Hub');options.SYSCTL_FILE.unlink()
        target=options.SWAP_DIRECTORY/'swapfile'
        if target.exists():
            active=any(line.split() and line.split()[0]==str(target) for line in pathlib.Path('/proc/swaps').read_text().splitlines()[1:])
            if active:options.command('swapoff',str(target))
            block=b'\n# Managed by Connect Hub: own additional swap only\n'+(str(target)+' none swap sw 0 0\n').encode()
            current=options.FSTAB.read_bytes();options.FSTAB.write_bytes(current.replace(block,b'',1))
            assert target.resolve().parent==options.SWAP_DIRECTORY.resolve() and not target.is_symlink();target.unlink()
        marker=options.SWAP_DIRECTORY/'.connect-hub-owned'
        if marker.exists():marker.unlink();options.SWAP_DIRECTORY.rmdir()
        assert swap_entries()==before_swap
        assert options.FSTAB.read_bytes()==before_fstab
        print('PASS: disposable VM tuning test restored prior TCP defaults, swap and fstab',flush=True)
