#!/usr/bin/env bash
# A detached, root-owned job. No SSH/sudo password is written to this server.
set -Eeuo pipefail
umask 077
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
job=$1
[[ $EUID == 0 && $job =~ ^/var/lib/connect-hub-installer/job\.[a-f0-9]{32}$ && ! -L $job && -f /var/lib/connect-hub-installer/.connect-hub-owned ]]
state(){ printf '{"state":"running","stage":"%s"}\n' "$1" > "$job/state.new";mv -f "$job/state.new" "$job/state.json"; }
failed(){ code=$?;if ((code));then printf '{"state":"failed","stage":"installing","code":%s}\n' "$code" > "$job/state.new";mv -f "$job/state.new" "$job/state.json";fi; }
trap failed EXIT
actual_update=0
[[ ! -f /etc/connect-hub/.connect-hub-owned ]] || actual_update=1
[[ $actual_update == "$CH_UPDATE" ]]
export CONNECT_HUB_NONINTERACTIVE=1 CONNECT_HUB_LANGUAGE=$CH_LANGUAGE
export CONNECT_HUB_HOST=$CH_HOST CONNECT_HUB_DOMAIN=$CH_DOMAIN
printf '%s' "$CH_BOOTSTRAP_B64" | base64 -d > "$job/bootstrap.sh"
state installing
bash "$job/bootstrap.sh" 2>&1 | sed -E '/password|пароль|USERNAME|Логин/Id' > "$job/install.log"
state configuring
export CH_JOB=$job
python3 - <<'PY'
import json,os,pathlib,sys,urllib.parse
job=pathlib.Path(os.environ['CH_JOB']);data=pathlib.Path('/etc/connect-hub')
if not (data/'.connect-hub-owned').is_file():raise SystemExit('Owned installation missing')
warnings=[]
if os.environ['CH_UPDATE']=='0':
    sys.path.insert(0,'/opt/connect-hub/current/hub')
    from system_options import enable_bbr,create_swap
    if os.environ['CH_BBR']=='1':
        try:enable_bbr('/opt/connect-hub')
        except Exception:warnings.append('BBR_UNAVAILABLE')
    size=int(os.environ['CH_SWAP'])
    if size not in (0,1,2,4,8):raise SystemExit('Invalid swap size')
    if size:
        try:create_swap(size,'/opt/connect-hub')
        except Exception:warnings.append('SWAP_UNAVAILABLE')
values=dict(line.split('=',1)for line in (data/'initial-access.txt').read_text().splitlines() if '=' in line)
for key in ('URL','USERNAME','PASSWORD'):
    if not values.get(key):raise SystemExit('Missing access result')
url=urllib.parse.urlparse(values['URL'])
if url.scheme not in ('http','https') or not url.hostname or url.username or url.password:raise SystemExit('Invalid panel address')
if os.environ['CH_DOMAIN'] and url.hostname!=os.environ['CH_DOMAIN']:warnings.append('DOMAIN_FALLBACK')
certificate=values.get('CERTIFICATE','unknown')
if certificate!='trusted':warnings.append('TEMPORARY_CERTIFICATE')
result={'state':'complete','stage':'complete','url':values['URL'],'username':values['USERNAME'],'password':values['PASSWORD'],'certificate':certificate,'warnings':warnings}
temporary=job/'state.new';temporary.write_text(json.dumps(result,ensure_ascii=False));temporary.chmod(0o600);temporary.replace(job/'state.json')
PY
