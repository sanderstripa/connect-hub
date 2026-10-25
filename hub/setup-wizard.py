#!/usr/bin/env python3
"""Bilingual first-run setup. Only explicit host-tuning choices mutate the host."""
import argparse,ipaddress,json,math,os,pathlib,re,shlex,shutil,socket,sys,urllib.request
from system_options import bbr_state,enable_bbr,swap_state,create_swap

def os_info():
    values={}
    for line in pathlib.Path('/etc/os-release').read_text().splitlines():
        if '=' in line:
            key,value=line.split('=',1);values[key]=shlex.split(value)[0] if value else ''
    return values
def hardware():
    memory=int(next(line.split()[1] for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:')))/1024/1024
    cpus=len(os.sched_getaffinity(0)) if hasattr(os,'sched_getaffinity') else os.cpu_count() or 1
    quota=pathlib.Path('/sys/fs/cgroup/cpu.max')
    if quota.exists():
        parts=quota.read_text().split()
        if parts[0]!='max':cpus=min(cpus,max(1,math.ceil(int(parts[0])/int(parts[1]))))
    disk=shutil.disk_usage('/')
    return {'cpus':cpus,'ramGB':round(memory,1),'diskGB':round(disk.total/1024**3),'freeGB':round(disk.free/1024**3,1)}
def public_addresses():
    result=set()
    for endpoint in ['https://api.ipify.org','https://api6.ipify.org']:
        try:
            with urllib.request.urlopen(endpoint,timeout=4) as response:result.add(str(ipaddress.ip_address(response.read(128).decode().strip())))
        except (OSError,ValueError):pass
    return result
def validate_domain(value):
    value=value.strip().rstrip('.').encode('idna').decode('ascii').lower()
    if len(value)>253 or '.' not in value or not all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?',part) for part in value.split('.')):
        raise ValueError('Use a domain name without https://, a port or a path')
    try:ipaddress.ip_address(value)
    except ValueError:return value
    raise ValueError('A domain name is required')
def domain_preflight(domain,addresses):
    resolved={str(ipaddress.ip_address(row[4][0])) for row in socket.getaddrinfo(domain,80,type=socket.SOCK_STREAM)}
    if not resolved:raise ValueError('DNS returned no addresses')
    if not addresses:raise ValueError('Cannot verify this server public address; retry or use IP')
    if not resolved<=addresses:raise ValueError('DNS points to another server or a proxy: '+', '.join(sorted(resolved)))
    with socket.socket() as listener:listener.bind(('0.0.0.0',80))
    return sorted(resolved)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--prefix',required=True);parser.add_argument('--data',required=True);args=parser.parse_args()
    if os.geteuid()!=0:raise SystemExit('Root or sudo is required')
    data=pathlib.Path(args.data)
    if not (data/'.connect-hub-owned').is_file():raise SystemExit('An owned Connect Hub installation is required')
    tty=None;tty_output=None
    if sys.stderr.isatty() and os.environ.get('CONNECT_HUB_NONINTERACTIVE')!='1':
        try:tty=open('/dev/tty','r');tty_output=open('/dev/tty','w')
        except OSError:pass
    language=os.environ.get('CONNECT_HUB_LANGUAGE','')
    def ask(ru,en,default=''):
        if not tty:return default
        tty_output.write((ru if language=='ru' else en)+' ');tty_output.flush()
        return tty.readline().strip() or default
    if language not in ('ru','en'):
        print('\nCONNECT. HUB\n');language='en'
        language='ru' if ask('1. Русский  2. English [1]:','1. Русский  2. English [1]:','1' if tty else '2')=='1' else 'en'
    def say(ru,en):print(ru if language=='ru' else en,flush=True)
    info=os_info();machine=hardware();number=lambda n:f'{n:g}'
    if os.environ.get('CONNECT_HUB_INTRO_SHOWN')!='1':
        print('\n'+info.get('NAME',info.get('ID','Linux'))+' '+info.get('VERSION_ID','')+' · '+str(machine['cpus'])+' CPU · '+number(machine['ramGB'])+' GB RAM · '+str(machine['diskGB'])+' GB disk',flush=True)
    say('Свободно на диске: '+number(machine['freeGB'])+' GB','Free disk space: '+number(machine['freeGB'])+' GB')
    if tty:
        try:
            state=bbr_state();say('TCP: '+state['current']+' · BBR: '+('доступен' if state['available'] else 'не поддерживается ядром'),'TCP: '+state['current']+' · BBR: '+('available' if state['available'] else 'not provided by this kernel'))
            say('BBR меняет TCP-настройки всего сервера. Это не ускоритель всех VPN и не ускоряет UDP напрямую.','BBR changes TCP defaults for the whole server. It is not a universal VPN accelerator and does not directly accelerate UDP.')
            if state['available'] and state['current']!='bbr' and ask('Включить BBR? [y/N]:','Enable BBR? [y/N]:','n').lower() in ('y','yes','д','да'):
                result=enable_bbr(args.prefix);say('BBR: '+result,'BBR: '+result)
        except (OSError,ValueError,RuntimeError) as error:say('BBR оставлен без изменений: '+str(error),'BBR kept unchanged: '+str(error))
        except Exception as error:say('Не удалось включить BBR: '+str(error),'Could not enable BBR: '+str(error))
        current=swap_state();say('Активная подкачка: '+number(current['sizeGB'])+' GB','Active swap: '+number(current['sizeGB'])+' GB')
        if machine['ramGB']<2 and not current['active']:say('Для небольшого объёма RAM рекомендуется дополнительная подкачка.','Additional swap is recommended for this small-memory server.')
        while True:
            size=ask('Добавить свой swap-файл: 0 — оставить как есть, 1 / 2 / 4 / 8 GB [0]:','Add an owned swap file: 0 — keep current setup, 1 / 2 / 4 / 8 GB [0]:','0')
            if size=='0':break
            try:
                say('Создаётся дополнительный swap-файл: '+size+' GB…','Creating an additional swap file: '+size+' GB…')
                result=create_swap(int(size),args.prefix);say('Подкачка: '+result,'Swap: '+str(size)+' GB created');break
            except Exception as error:say('Не удалось завершить настройку подкачки: '+str(error),'Could not complete swap setup: '+str(error))
    host=os.environ.get('CONNECT_HUB_HOST','');addresses=set()
    if host:
        try:host=str(ipaddress.ip_address(host));addresses.add(host)
        except ValueError:host=''
    if not host:
        addresses=public_addresses();host=next((value for value in sorted(addresses) if ':' not in value),next(iter(addresses),'127.0.0.1'))
        while tty and not addresses:
            try:host=str(ipaddress.ip_address(ask('Не удалось определить IP. IP-адрес сервера:','Could not detect the public IP. Server IP address:')));addresses.add(host)
            except ValueError:say('Укажите корректный IP-адрес.','Enter a valid IP address.')
    say('IP-адрес панели: '+host,'Panel IP address: '+host)
    mode=ask('Адрес панели: 1 — IP-адрес  2 — домен + HTTPS [1]:','Panel address: 1 — IP address  2 — domain + HTTPS [1]:','1')
    domain=os.environ.get('CONNECT_HUB_DOMAIN','')
    if domain:mode='2'
    while mode=='2':
        domain=domain or ask('Домен панели:','Panel domain:')
        try:
            domain=validate_domain(domain)
            if not addresses or not all(ipaddress.ip_address(value).is_global for value in addresses):addresses=public_addresses()
            domain_preflight(domain,addresses)
            say('DNS соответствует серверу, локальный TCP 80 свободен. Доступ извне окончательно проверит Let’s Encrypt при выпуске.','DNS matches this server and local TCP 80 is free. Let’s Encrypt will verify external reachability during issuance.')
            break
        except (OSError,ValueError) as error:
            say('Проверка домена не прошла: '+str(error),'Domain check failed: '+str(error))
            if ask('1 — другой домен / повторить  2 — вернуться к IP [2]:','1 — retry/change domain  2 — return to IP [2]:','2')=='1':domain=''
            else:domain='';mode='1'
    state={'language':language,'host':host,'domain':domain if mode=='2' else '', 'addressMode':'domain' if mode=='2' else 'ip','hardware':machine,'os':info.get('PRETTY_NAME','Linux')}
    path=data/'setup.json';path.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n');path.chmod(0o600)
    # Values are strictly validated; the parent reads an allowlist without eval.
    env=data/'setup.env';env.write_text('CONNECT_HUB_LANGUAGE='+language+'\nCONNECT_HUB_HOST='+host+'\nCONNECT_HUB_DOMAIN='+state['domain']+'\nCONNECT_HUB_ADDRESS_MODE='+state['addressMode']+'\n');env.chmod(0o600)
    say('HTTPS и автоматическое продление будут настроены для выбранного адреса.','HTTPS and automatic renewal will be configured for the selected address.')
    if tty:tty.close()
    if tty_output:tty_output.close()

if __name__=='__main__':main()
