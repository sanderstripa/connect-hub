#!/usr/bin/env bash
# Connect Hub installer, added 2026-10-23. GPL-3.0.
set -Eeuo pipefail
umask 077
package= checksum= update=0 service=1
prefix=${CONNECT_HUB_PREFIX:-/opt/connect-hub}
data=${CONNECT_HUB_DATA:-/etc/connect-hub}
logs=${CONNECT_HUB_LOGS:-/var/log/connect-hub}
listen=${CONNECT_HUB_LISTEN:-0.0.0.0}
while (($#)); do
 case "$1" in
  --package) package=$2;shift 2;; --sha256) checksum=$2;shift 2;;
  --update) update=1;shift;; --no-service) service=0;shift;;
  *) echo "Usage: install.sh --package ARCHIVE --sha256 SHA256 [--update] [--no-service]" >&2;exit 2;;
 esac
done
die(){ echo "Connect Hub: $*" >&2;exit 1; }
[[ $listen == 0.0.0.0 || $listen == 127.0.0.1 ]] || die 'CONNECT_HUB_LISTEN must be 0.0.0.0 or 127.0.0.1'
[[ $(uname -s) == Linux ]] || die 'Linux is required'
for tool in python3 openssl curl sha256sum realpath;do command -v "$tool" >/dev/null || die "Required tool missing: $tool";done
if ((service));then for tool in systemctl useradd;do command -v "$tool" >/dev/null || die "Required tool missing: $tool";done;fi
[[ $service == 0 || $EUID == 0 ]] || die 'Run as root for systemd installation'
if ((service)) && ((!update)) && id connect-hub >/dev/null 2>&1;then die 'An existing connect-hub account will not be adopted';fi
if ((service)) && ((!update));then
 load_state=$(systemctl show connect-hub.service -p LoadState --value || true)
 [[ $load_state == not-found ]] || die 'An existing connect-hub service will not be adopted'
fi
[[ -n $package && $checksum =~ ^[a-fA-F0-9]{64}$ ]] || die 'A built Connect Hub package and its SHA-256 are required; see the GitHub Actions build artifacts'
for dir in "$prefix" "$data" "$logs"; do
 [[ $dir =~ ^/[a-zA-Z0-9_./-]+$ && $dir != / && $dir != /etc && $dir != /opt && $dir != /var && $dir != /var/log && $dir != *..* && ! -L $dir ]] || die 'Use dedicated absolute directories without symlinks'
 [[ $(realpath -m "$dir") == "$dir" ]] || die 'Parent directory symlinks are not supported'
done
for a in "$prefix" "$data" "$logs";do
 for b in "$prefix" "$data" "$logs";do
  [[ $a == "$b" || $a != "$b/"* ]] || die 'Managed directories must not contain each other'
 done
done
[[ $prefix != "$data" && $prefix != "$logs" && $data != "$logs" ]] || die 'Installation, data and log directories must be distinct'
if ((service)) && [[ -e /etc/systemd/system/connect-hub.service ]] && ! grep -q '^# Managed by Connect Hub$' /etc/systemd/system/connect-hub.service;then die 'An unowned connect-hub.service already exists';fi
if ((update)); then
 [[ -L $prefix/current && -f $data/.connect-hub-owned ]] || die 'No managed Connect Hub installation found; no foreign installation will be adopted'
else
 [[ ! -e $prefix && ! -e $data && ! -e $logs ]] || die 'Fresh installation refuses existing destination directories; use --update only for Connect Hub'
fi
printf '%s  %s\n' "$checksum" "$package" | sha256sum --check --status || die 'Package checksum mismatch'
tmp=$(mktemp -d);trap 'rm -rf -- "$tmp"' EXIT
# Do not extract arbitrary paths or symlinks from an archive supplied to root.
python3 - "$package" "$tmp" <<'PY'
import pathlib,shutil,sys,tarfile
with tarfile.open(sys.argv[1]) as t:
 for m in t.getmembers():
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0]!='connect-hub' or not(m.isfile() or m.isdir()):raise SystemExit('Unsafe package member')
 # Validated regular files/directories only; no archive links or special modes.
 # Avoid requiring Python 3.12's extraction-filter API on Debian 12/Ubuntu 22.
 for m in t.getmembers():
  dest=pathlib.Path(sys.argv[2]).joinpath(*pathlib.PurePosixPath(m.name).parts)
  if m.isdir():dest.mkdir(parents=True,exist_ok=True);dest.chmod(0o755)
  else:
   dest.parent.mkdir(parents=True,exist_ok=True)
   with t.extractfile(m) as source,dest.open('wb') as output:shutil.copyfileobj(source,output)
   dest.chmod(0o755 if m.mode&0o111 else 0o644)
PY
[[ -x $tmp/connect-hub/connect-hub && -f $tmp/connect-hub/BUILD.json && -f $tmp/connect-hub/LICENSE ]] || die 'Incomplete package'
revision=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["revision"])' "$tmp/connect-hub/BUILD.json")
[[ $revision =~ ^[a-f0-9]{40}$ ]] || die 'Invalid package revision'
target=$prefix/releases/$revision
if [[ -e $target ]];then
 if ((update)) && [[ $(readlink -f "$prefix/current") == "$target" ]];then
  printf 'Connect Hub is already up to date.\n'
  exit 0
 fi
 die 'This revision already exists but is not the active managed revision'
fi
mkdir -p "$prefix/releases" "$logs"
backup= old= was_active=0
activated=0
rollback(){
 result=$?
 if ((result && activated && update)); then
  if ((service));then systemctl stop connect-hub || true;fi
  ln -s "$old" "$prefix/current.rollback";mv -Tf "$prefix/current.rollback" "$prefix/current"
  # Preserve the failed migration database rather than overwrite or delete it.
  mv "$data" "$backup/failed-data";cp -a "$backup/data" "$data"
  if ((service && was_active));then systemctl start connect-hub || true;fi
  echo "Update failed. Previous binary/data restored; failed data retained in $backup" >&2
 elif ((result && service && was_active));then systemctl start connect-hub || true
 fi
 rm -rf -- "$tmp"
 exit "$result"
}
trap rollback EXIT
if ((update)); then
 old=$(readlink -f "$prefix/current")
 [[ $old == "$prefix/releases/"* ]] || die 'Current release points outside managed releases'
 if ((service)) && systemctl is-active --quiet connect-hub; then was_active=1;systemctl stop connect-hub;fi
 backup=$prefix/backups/$(date -u +%Y%m%dT%H%M%SZ)-$$
 mkdir -p "$backup";cp -a "$data" "$backup/data"
 printf '%s\n' "$old" > "$backup/previous-release"
else
 mkdir -p "$data/integrations";touch "$data/.connect-hub-owned"
fi
cp -a "$tmp/connect-hub" "$target"
# Never inherit database DSNs, keys, ports or paths exported by another 3x-ui
# installation in the invoking shell. This installer always initializes SQLite.
for inherited in ${!XUI_@};do unset "$inherited";done
unset NODE_TOKEN_ENCRYPTION
export XUI_DB_TYPE=sqlite XUI_DB_DSN= XUI_PORT= XUI_NODE_TOKEN_KEY=
export XUI_DB_FOLDER=$data XUI_LOG_FOLDER=$logs XUI_BIN_FOLDER=$target/bin XUI_MAIN_FOLDER=$target
export XUI_NODE_TOKEN_KEY_FILE=$data/node_token_key.json
if ((!update));then
 if [[ -z ${CONNECT_HUB_PORT:-} && -t 2 && -r /dev/tty ]];then
  read -r -p 'Panel port (Enter = choose a free port): ' CONNECT_HUB_PORT </dev/tty || true
 fi
 panel_port=$(python3 - "${CONNECT_HUB_PORT:-0}" "$listen" <<'PY'
import socket,sys
port=int(sys.argv[1])
if port and not 1024<=port<=65535:raise SystemExit('CONNECT_HUB_PORT must be 1024..65535')
with socket.socket() as s:
 s.bind((sys.argv[2],port));print(s.getsockname()[1])
PY
 )
 username=hub-$(openssl rand -hex 4);password=$(openssl rand -hex 24);path=/$(openssl rand -hex 16)/
 "$target/connect-hub" setting -username "$username" -password "$password" -port "$panel_port" -listenIP "$listen" -webBasePath "$path" -parallelTest
 host=127.0.0.1
 if [[ $listen != 127.0.0.1 ]];then
  host=${CONNECT_HUB_HOST:-}
  if [[ -z $host ]];then host=$(curl -4fsS --connect-timeout 3 --max-time 6 https://api.ipify.org || true);fi
  host=$(python3 - "$host" <<'PY'
import ipaddress,socket,sys
try:print(ipaddress.IPv4Address(sys.argv[1]))
except ValueError:
 try:print(ipaddress.IPv4Address(socket.gethostbyname(socket.gethostname())))
 except (ValueError,OSError):print('127.0.0.1')
PY
  )
 fi
 printf 'URL=http://%s:%s%s\nLOCAL_URL=http://127.0.0.1:%s%s\nUSERNAME=%s\nPASSWORD=%s\n' "$host" "$panel_port" "$path" "$panel_port" "$path" "$username" "$password" > "$data/initial-access.txt"
fi
ln -s "$target" "$prefix/current.new";mv -Tf "$prefix/current.new" "$prefix/current";activated=1
if ((service));then
 if ! id connect-hub >/dev/null 2>&1;then useradd --system --user-group --no-create-home --home-dir "$data" --shell /usr/sbin/nologin connect-hub;fi
 chmod 0755 "$prefix" "$prefix/releases" "$target"
 chown -R connect-hub:connect-hub "$data" "$logs" "$target/bin"
 # Refuse to replace a pre-existing, unowned unit.
 unit=/etc/systemd/system/connect-hub.service
 if [[ -e $unit ]] && ! grep -q '^# Managed by Connect Hub$' "$unit";then die 'An unowned connect-hub.service already exists';fi
 cat > "$unit" <<EOF
# Managed by Connect Hub
[Unit]
Description=Connect Hub server panel
After=network.target
[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$prefix/current
ExecStart=$prefix/current/connect-hub
Environment=XUI_DB_FOLDER=$data
Environment=XUI_DB_TYPE=sqlite
Environment=XUI_DB_DSN=
Environment=XUI_PORT=
Environment=XUI_NODE_TOKEN_KEY=
Environment=NODE_TOKEN_ENCRYPTION=off
Environment=XUI_LOG_FOLDER=$logs
Environment=XUI_BIN_FOLDER=$prefix/current/bin
Environment=XUI_MAIN_FOLDER=$prefix/current
Environment=XUI_NODE_TOKEN_KEY_FILE=$data/node_token_key.json
Environment=CONNECT_HUB_INTEGRATIONS_DIR=$data/integrations
Environment=CONNECT_HUB_NATIVE_INSTALL=1
EnvironmentFile=-$data/panel.env
EnvironmentFile=-$data/integrations.env
Restart=on-failure
KillMode=control-group
TimeoutStopSec=30
UMask=0077
[Install]
WantedBy=multi-user.target
EOF
 # Keep a familiar management command, scoped to this installation only.
 if [[ -e /usr/local/bin/connect-hub ]] && ! grep -q 'Connect Hub modifications' /usr/local/bin/connect-hub;then die 'Refusing to replace a foreign connect-hub command';fi
 install -m 0755 "$target/x-ui.sh" /usr/local/bin/connect-hub
 cert_settings=$("$target/connect-hub" setting -getCert true)
 if ! grep -q '^cert: .' <<< "$cert_settings";then
  . "$target/hub/setup-ssl.sh"
  setup_install_ssl
 fi
 systemctl daemon-reload;systemctl enable --now connect-hub
 settings=$("$target/connect-hub" setting -show true)
 panel_port=$(printf '%s\n' "$settings" | sed -n 's/^port: //p')
 panel_path=$(printf '%s\n' "$settings" | sed -n 's/^webBasePath: //p')
 scheme=http
 if grep -q '^Panel is secure with SSL$' <<< "$settings";then scheme=https;fi
 python3 - "$data/initial-access.txt" "$panel_port" "$panel_path" "$scheme" <<'PY'
import pathlib,sys,urllib.parse
p=pathlib.Path(sys.argv[1]);values=dict(line.split('=',1)for line in p.read_text().splitlines())
u=urllib.parse.urlparse(values['URL']);host=u.hostname
if ':'in host:host=f'[{host}]'
values['URL']=urllib.parse.urlunparse(u._replace(scheme=sys.argv[4],netloc=f'{host}:{sys.argv[2]}',path=sys.argv[3]))
values['LOCAL_URL']=f'{sys.argv[4]}://127.0.0.1:{sys.argv[2]}{sys.argv[3]}'
p.write_text(''.join(f'{key}={value}\n'for key,value in values.items()));p.chmod(0o600)
PY
 health=0
 for attempt in {1..20};do
  # Local health probe only: the temporary certificate is intentionally not a public CA certificate.
  local_url=$(sed -n 's/^LOCAL_URL=//p' "$data/initial-access.txt")
  if curl --noproxy '*' --insecure -sS -o /dev/null "$local_url";then health=1;break;fi
  sleep 1
 done
 [[ $health == 1 ]] && systemctl is-active --quiet connect-hub || die 'Service failed health check' 
fi
green= cyan= yellow= bold= reset=
if [[ -t 1 && -z ${NO_COLOR:-} ]];then green=$'\033[32m';cyan=$'\033[36m';yellow=$'\033[33m';bold=$'\033[1m';reset=$'\033[0m';fi
printf '\n%s============================================================%s\n' "$green" "$reset"
printf '%s                 CONNECT HUB — READY%s\n' "$bold" "$reset"
printf '%s============================================================%s\n\n' "$green" "$reset"
while IFS='=' read -r key value;do
 case "$key" in
  URL) printf '%s  Open in browser / Адрес панели:%s\n\n    %s\n\n' "$cyan" "$reset" "$value";;
  USERNAME) if ((!update));then printf '  Username / Логин:    %s%s%s\n' "$bold" "$value" "$reset";fi;;
  PASSWORD) if ((!update));then printf '  Password / Пароль:  %s%s%s\n\n' "$bold" "$value" "$reset";fi;;
  CERTIFICATE) if [[ $value == trusted ]];then printf '%s  HTTPS: trusted Let’s Encrypt certificate; automatic renewal.%s\n\n' "$green" "$reset";else printf '%s  HTTPS: temporary certificate — browser warning expected.\n  Retry trusted issuance: sudo connect-hub → SSL certificate.%s\n\n' "$yellow" "$reset";fi;;
 esac
done < "$data/initial-access.txt"
if ((update));then printf '  Use your current login and password / Логин и пароль сохранены.\n\n';fi
printf '  Access details / Данные входа: %s/initial-access.txt\n' "$data"
printf '  Management menu / Меню управления: sudo connect-hub\n'
printf '  If blocked, allow only the chosen new panel TCP port.\n'
[[ -z $backup ]] || printf '  Backup retained / Резервная копия: %s\n' "$backup"
printf '\n%s============================================================%s\n\n' "$green" "$reset"
