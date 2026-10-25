"""Opt-in host tuning. Never replace a kernel or modify an existing swap."""
import datetime,os,pathlib,shutil,subprocess,tempfile
SYSCTL_FILE=pathlib.Path('/etc/sysctl.d/90-connect-hub-bbr.conf')
SWAP_DIRECTORY=pathlib.Path('/var/lib/connect-hub-swap')
FSTAB=pathlib.Path('/etc/fstab')

def command(*args):
    return subprocess.run(args,text=True,capture_output=True,check=True).stdout.strip()

def bbr_state():
    current=command('sysctl','-n','net.ipv4.tcp_congestion_control')
    available=command('sysctl','-n','net.ipv4.tcp_available_congestion_control').split()
    loadable='bbr' in available
    if not loadable and shutil.which('modprobe'):
        loadable=subprocess.run(['modprobe','-n','tcp_bbr'],capture_output=True).returncode==0
    return {'current':current,'available':loadable,'qdisc':command('sysctl','-n','net.core.default_qdisc')}

def enable_bbr(prefix):
    state=bbr_state()
    if not state['available']:raise RuntimeError('This kernel does not provide BBR. Kernel was not changed.')
    target=SYSCTL_FILE
    if target.is_symlink() or (target.exists() and not target.read_text().startswith('# Managed by Connect Hub\n')):
        raise RuntimeError('A foreign BBR configuration occupies the Connect Hub path.')
    if state['current']=='bbr' and state['qdisc']=='fq':return 'already-enabled'
    if 'bbr' not in command('sysctl','-n','net.ipv4.tcp_available_congestion_control').split():command('modprobe','tcp_bbr')
    changed=[]
    try:
        for key,value,old in [('net.core.default_qdisc','fq',state['qdisc']),('net.ipv4.tcp_congestion_control','bbr',state['current'])]:
            command('sysctl','-w',key+'='+value);changed.append((key,old))
        if command('sysctl','-n','net.ipv4.tcp_congestion_control')!='bbr':raise RuntimeError('BBR was not activated')
        backup=pathlib.Path(prefix)/'backups/system-options';backup.mkdir(parents=True,exist_ok=True)
        stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        (backup/('bbr-before-'+stamp+'.txt')).write_text('congestion='+state['current']+'\nqdisc='+state['qdisc']+'\n')
        if target.exists():shutil.copy2(target,backup/('bbr-config-'+stamp+'.conf'))
        target.parent.mkdir(parents=True,exist_ok=True)
        with tempfile.NamedTemporaryFile(mode='w',dir=target.parent,delete=False) as stream:
            stream.write('# Managed by Connect Hub\nnet.core.default_qdisc=fq\nnet.ipv4.tcp_congestion_control=bbr\n');temporary=pathlib.Path(stream.name)
        temporary.chmod(0o644);temporary.replace(target)
    except Exception:
        for key,value in reversed(changed):
            try:command('sysctl','-w',key+'='+value)
            except subprocess.CalledProcessError:pass
        raise
    return 'enabled'

def swap_state():
    rows=pathlib.Path('/proc/swaps').read_text().splitlines()[1:]
    return {'active':len(rows),'sizeGB':sum(int(row.split()[2]) for row in rows)/1024/1024}

def create_swap(size_gb,prefix):
    if not isinstance(size_gb,int) or not 1<=size_gb<=32:raise ValueError('Swap size must be 1..32 GB')
    folder=SWAP_DIRECTORY;target=folder/'swapfile';marker=folder/'.connect-hub-owned'
    if folder.is_symlink() or (folder.exists() and not marker.is_file()):raise RuntimeError('Foreign swap directory; left untouched')
    if target.exists() or target.is_symlink():raise RuntimeError('Existing swap file retained; automatic resizing is disabled')
    fstab=FSTAB
    if fstab.is_symlink():raise RuntimeError('Refusing to replace a linked fstab')
    free=shutil.disk_usage('/var/lib').free
    required=size_gb*1024**3
    if free-required<max(2*1024**3,int(shutil.disk_usage('/var/lib').total*.1)):
        raise RuntimeError('Insufficient free disk space after reserving space for the operating system')
    filesystem=command('findmnt','-n','-o','FSTYPE','-T','/var/lib')
    if filesystem not in ('ext4','xfs','btrfs'):raise RuntimeError('Swap-file creation is not supported on '+filesystem)
    if filesystem=='btrfs' and not shutil.which('btrfs'):raise RuntimeError('btrfs-progs is required to safely create a Btrfs swap file')
    folder.mkdir(mode=0o700,exist_ok=True);folder.chmod(0o700);marker.touch(mode=0o600)
    try:
        if filesystem=='btrfs':command('btrfs','filesystem','mkswapfile','--size',str(size_gb)+'G',str(target))
        else:
            descriptor=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);os.close(descriptor)
            command('dd','if=/dev/zero','of='+str(target),'bs=1M','count='+str(size_gb*1024),'status=none','conv=fsync')
            command('mkswap',str(target))
        target.chmod(0o600)
        command('swapon',str(target))
    except Exception:
        # This path was absent on entry and its parent is private/owned.
        # Remove only our unactivated partial allocation, never any existing swap.
        if target.is_file() and not target.is_symlink() and target.resolve().parent==folder.resolve():target.unlink()
        raise
    try:
        original=fstab.read_bytes() if fstab.exists() else b''
        if any(line.split() and line.split()[0]==str(target) for line in original.decode().splitlines() if not line.lstrip().startswith('#')):
            return str(target)
        backup=pathlib.Path(prefix)/'backups/system-options';backup.mkdir(parents=True,exist_ok=True)
        stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        (backup/('fstab-before-'+stamp)).write_bytes(original)
        with fstab.open('ab') as stream:
            stream.write(b'\n# Managed by Connect Hub: own additional swap only\n'+(str(target)+' none swap sw 0 0\n').encode())
    except Exception:
        command('swapoff',str(target))
        raise
    return str(target)
