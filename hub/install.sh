#!/usr/bin/env bash
# Connect Hub installer, added 2026-10-23. GPL-3.0.
set -Eeuo pipefail
umask 077
package= checksum= update=0 service=1
prefix=${CONNECT_HUB_PREFIX:-/opt/connect-hub}
data=${CONNECT_HUB_DATA:-/etc/connect-hub}
logs=${CONNECT_HUB_LOGS:-/var/log/connect-hub}
while (($#)); do
 case "$1" in
  --package) package=$2;shift 2;; --sha256) checksum=$2;shift 2;;
  --update) update=1;shift;; --no-service) service=0;shift;;
  *) echo "Usage: install.sh --package ARCHIVE --sha256 SHA256 [--update] [--no-service]" >&2;exit 2;;
 esac
done
die(){ echo "Connect Hub: $*" >&2;exit 1; }
[[ $(uname -s) == Linux ]] || die 'Linux is required'
[[ $service == 0 || $EUID == 0 ]] || die 'Run as root for systemd installation'
[[ -n $package && $checksum =~ ^[a-fA-F0-9]{64}$ ]] || die 'A built Connect Hub package and its SHA-256 are required; see the GitHub Actions build artifacts'
for dir in "$prefix" "$data" "$logs"; do
 [[ $dir == /* && $dir != / && $dir != /etc && $dir != /opt && $dir != /var && $dir != /var/log && $dir != *..* && ! -L $dir ]] || die 'Use dedicated absolute directories without symlinks'
 [[ $(realpath -m "$dir") == "$dir" ]] || die 'Parent directory symlinks are not supported'
done
[[ $prefix != "$data" && $prefix != "$logs" && $data != "$logs" ]] || die 'Installation, data and log directories must be distinct'
if ((update)); then
 [[ -L $prefix/current && -f $data/.connect-hub-owned ]] || die 'No managed Connect Hub installation found; no foreign installation will be adopted'
else
 [[ ! -e $prefix && ! -e $data ]] || die 'Fresh installation refuses existing destination directories; use --update only for Connect Hub'
fi
printf '%s  %s\n' "$checksum" "$package" | sha256sum --check --status || die 'Package checksum mismatch'
tmp=$(mktemp -d);trap 'rm -rf -- "$tmp"' EXIT
# Do not extract arbitrary paths or symlinks from an archive supplied to root.
python3 - "$package" "$tmp" <<'PY'
import pathlib,sys,tarfile
with tarfile.open(sys.argv[1]) as t:
 for m in t.getmembers():
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0]!='connect-hub' or not(m.isfile() or m.isdir()):raise SystemExit('Unsafe package member')
 t.extractall(sys.argv[2],filter='data')
PY
[[ -x $tmp/connect-hub/connect-hub && -f $tmp/connect-hub/BUILD.json && -f $tmp/connect-hub/LICENSE ]] || die 'Incomplete package'
revision=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["revision"])' "$tmp/connect-hub/BUILD.json")
[[ $revision =~ ^[a-f0-9]{40}$ ]] || die 'Invalid package revision'
target=$prefix/releases/$revision
[[ ! -e $target ]] || die 'This revision is already installed'
mkdir -p "$prefix/releases" "$logs"
backup= old= was_active=0
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
activated=0
rollback(){
 result=$?
 if ((result && activated && update)); then
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
cp -a "$tmp/connect-hub" "$target"
export XUI_DB_FOLDER=$data XUI_LOG_FOLDER=$logs XUI_BIN_FOLDER=$target/bin XUI_MAIN_FOLDER=$target
export XUI_NODE_TOKEN_KEY_FILE=$data/node_token_key.json
if ((!update));then
 username=hub-$(openssl rand -hex 4);password=$(openssl rand -hex 24);path=/$(openssl rand -hex 16)/
 "$target/connect-hub" setting -username "$username" -password "$password" -port 2053 -listenIP 127.0.0.1 -webBasePath "$path"
 printf 'URL=http://127.0.0.1:2053%s\nUSERNAME=%s\nPASSWORD=%s\n' "$path" "$username" "$password" > "$data/initial-access.txt"
fi
ln -s "$target" "$prefix/current.new";mv -Tf "$prefix/current.new" "$prefix/current";activated=1
if ((service));then
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
WorkingDirectory=$prefix/current
ExecStart=$prefix/current/connect-hub
Environment=XUI_DB_FOLDER=$data
Environment=XUI_LOG_FOLDER=$logs
Environment=XUI_BIN_FOLDER=$prefix/current/bin
Environment=XUI_MAIN_FOLDER=$prefix/current
Environment=XUI_NODE_TOKEN_KEY_FILE=$data/node_token_key.json
Environment=CONNECT_HUB_INTEGRATIONS_DIR=$data/integrations
EnvironmentFile=-$data/integrations.env
Restart=on-failure
KillMode=control-group
TimeoutStopSec=30
UMask=0077
[Install]
WantedBy=multi-user.target
EOF
 systemctl daemon-reload;systemctl enable --now connect-hub
 settings=$("$target/connect-hub" setting -show true)
 panel_port=$(printf '%s\n' "$settings" | sed -n 's/^port: //p')
 health=0
 for attempt in {1..20};do
  if curl --noproxy '*' -sS -o /dev/null "http://127.0.0.1:${panel_port}/";then health=1;break;fi
  sleep 1
 done
 [[ $health == 1 ]] && systemctl is-active --quiet connect-hub || die 'Service failed health check' 
fi
echo "Connect Hub installed: $revision"
if ((!update));then echo "Initial access saved privately: $data/initial-access.txt";cat "$data/initial-access.txt";fi
[[ -z $backup ]] || echo "Backup retained: $backup"
