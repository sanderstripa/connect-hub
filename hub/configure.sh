#!/usr/bin/env bash
# Connect Hub integration of the original 3x-ui installation configuration.
# GPL-3.0; upstream authorship and source revision are retained in NOTICE.
set -eo pipefail
prefix=${CONNECT_HUB_PREFIX:-/opt/connect-hub}
data=${CONNECT_HUB_DATA:-/etc/connect-hub}
[[ $EUID == 0 && -f $data/.connect-hub-owned && -x $prefix/current/connect-hub ]] || exit 1
xui_folder=$prefix/current
xui_service=/etc/systemd/system
red='\033[0;31m';green='\033[0;32m';blue='\033[0;34m';yellow='\033[0;33m';plain='\033[0m'
source /etc/os-release
release=$ID
echo "The OS release is: $release"
NONINTERACTIVE=0
if [[ ${XUI_NONINTERACTIVE:-0} == 1 || ! -t 0 ]];then NONINTERACTIVE=1;fi
export NONINTERACTIVE
source "$xui_folder/hub/upstream-install-functions.sh"
for option in USERNAME PASSWORD WEB_BASE_PATH PANEL_PORT SSL_MODE DOMAIN SSL_IPV6 DB_TYPE DB_DSN;do
 own_name=CONNECT_HUB_$option
 if [[ -n ${!own_name+x} ]];then export "XUI_$option=${!own_name}";fi
done
if [[ -n ${CONNECT_HUB_PORT:-} ]];then export XUI_PANEL_PORT=$CONNECT_HUB_PORT;fi

# Keep PostgreSQL setup from adopting or restarting an existing installation.
install_postgres_local() {
 if command -v pg_lsclusters >/dev/null && [[ -n $(pg_lsclusters -h 2>/dev/null) ]];then
  echo 'Existing PostgreSQL cluster detected. Choose an explicit separate database; it will not be adopted or restarted.' >&2
  return 1
 fi
 if command -v psql >/dev/null || command -v postgres >/dev/null;then
  echo 'Existing PostgreSQL installation detected. Choose an explicit separate database.' >&2
  return 1
 fi
 _upstream_install_postgres_local
}

# Only the ACME executable/storage differs: pinned and owned by this fork.
install_acme() {
 mkdir -p "$prefix/acme"
 chmod 0700 "$prefix/acme"
 cat > "$prefix/acme/acme.sh" <<'ACME'
#!/usr/bin/env bash
for arg in "$@";do [[ $arg != --upgrade ]] || exit 0;done
exec bash /opt/connect-hub/current/hub/third-party/acme.sh --home /opt/connect-hub/acme --config-home /opt/connect-hub/acme --cert-home /opt/connect-hub/acme/certs "$@"
ACME
 chmod 0700 "$prefix/acme/acme.sh"
 for unit in connect-hub-cert-renew.service connect-hub-cert-renew.timer;do
  if [[ -e /etc/systemd/system/$unit ]] && ! grep -q '^# Managed by Connect Hub$' "/etc/systemd/system/$unit";then
   echo "Refusing to replace foreign $unit" >&2;return 1
  fi
 done
 cat > /etc/systemd/system/connect-hub-cert-renew.service <<EOF
# Managed by Connect Hub
[Unit]
Description=Renew only Connect Hub certificates using its isolated ACME account
[Service]
Type=oneshot
ExecStart=/bin/bash $prefix/acme/acme.sh --cron
EOF
 cat > /etc/systemd/system/connect-hub-cert-renew.timer <<'EOF'
# Managed by Connect Hub
[Unit]
Description=Check Connect Hub certificate renewal twice daily
[Timer]
OnActiveSec=10min
OnUnitActiveSec=12h
RandomizedDelaySec=15min
Persistent=true
[Install]
WantedBy=timers.target
EOF
 systemctl daemon-reload
 systemctl enable --now connect-hub-cert-renew.timer
}

# Keep the original certificate menu and custom-path workflow. The explicit
# selfsigned CI mode never contacts the public CA; normal mode uses upstream.
ssl_cert_issue() {
 install_acme || return 1
 _upstream_ssl_cert_issue
}
setup_ip_certificate() {
 python3 - "$1" "${2:-}" <<'PY' || return 1
import ipaddress,sys
ipaddress.IPv4Address(sys.argv[1])
if sys.argv[2]:ipaddress.IPv6Address(sys.argv[2])
PY
 _upstream_setup_ip_certificate "$@"
}
prompt_and_setup_ssl() {
 local panel_port=$1 web_path=$2 server_ip=$3
 printf 'URL=http://%s:%s/%s\nLOCAL_URL=http://127.0.0.1:%s/%s\nUSERNAME=%s\nPASSWORD=%s\n' "$server_ip" "$panel_port" "${web_path#/}" "$panel_port" "${web_path#/}" "$config_username" "$config_password" > "$data/initial-access.txt"
 if [[ ${CONNECT_HUB_TLS_MODE:-auto} == selfsigned ]];then
  CONNECT_HUB_DOMAIN="$server_ip" bash "$xui_folder/hub/cert.sh"
  SSL_SCHEME=https;SSL_HOST=$server_ip
 else
  if [[ ${CONNECT_HUB_TLS_MODE:-auto} == off ]];then export XUI_SSL_MODE=none
  elif [[ -n ${CONNECT_HUB_DOMAIN:-} ]];then export XUI_SSL_MODE=domain XUI_DOMAIN="$CONNECT_HUB_DOMAIN"
  else export XUI_SSL_MODE=${XUI_SSL_MODE:-ip};fi
  _upstream_prompt_and_setup_ssl "$@"
  if [[ $SSL_SCHEME == https ]] && ! "$xui_folder/connect-hub" setting -getCert true | grep -q '^cert: .';then
   echo 'Certificate issuance did not finish. Enabling a clearly identified temporary certificate.' >&2
   CONNECT_HUB_TLS_MODE=selfsigned CONNECT_HUB_DOMAIN="${SSL_HOST:-$server_ip}" bash "$xui_folder/hub/cert.sh" || return 1
  fi
 fi
}

# The source installer supports selecting the DB, port, credentials, TLS mode
# and custom certificate paths. Run that original flow against the fresh DB.
if [[ $NONINTERACTIVE == 1 && -z ${XUI_PANEL_PORT:-} ]];then
 XUI_PANEL_PORT=$(python3 - <<'PY'
import socket
with socket.socket() as sock:
 sock.bind(('0.0.0.0',0));print(sock.getsockname()[1])
PY
 )
 export XUI_PANEL_PORT
fi
set +e
config_after_install
result=$?
set -e
[[ $result == 0 && -f $data/install-result.env ]] || { echo 'Original installation configuration did not finish.' >&2;exit 1; }
source "$data/install-result.env"
certificate_state=$(sed -n 's/^CERTIFICATE=//p' "$data/initial-access.txt")
printf 'URL=%s\nLOCAL_URL=%s://127.0.0.1:%s/%s\nUSERNAME=%s\nPASSWORD=%s\n' "$XUI_ACCESS_URL" "${XUI_ACCESS_URL%%:*}" "$XUI_PANEL_PORT" "${XUI_WEB_BASE_PATH#/}" "$XUI_USERNAME" "$XUI_PASSWORD" > "$data/initial-access.txt"
if [[ -n $certificate_state ]];then printf 'CERTIFICATE=%s\n' "$certificate_state" >> "$data/initial-access.txt";fi
chmod 0600 "$data/initial-access.txt"
touch "$data/.upstream-configured"
