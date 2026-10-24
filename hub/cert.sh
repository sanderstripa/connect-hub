#!/usr/bin/env bash
# Connect Hub certificate lifecycle. Modified 2026-10-24. GPL-3.0.
# Uses the same Let's Encrypt shortlived IP profile as upstream 3x-ui.
set -Eeuo pipefail
umask 077
prefix=${CONNECT_HUB_PREFIX:-/opt/connect-hub}
data=${CONNECT_HUB_DATA:-/etc/connect-hub}
[[ $EUID == 0 ]] || { echo 'Run certificate setup as root.' >&2; exit 1; }
[[ -f $data/.connect-hub-owned && -x $prefix/current/connect-hub ]] || exit 1
[[ ! -L $prefix/acme && ! -L $prefix/tls ]] || exit 1
mode=${CONNECT_HUB_TLS_MODE:-auto}
[[ $mode == auto || $mode == selfsigned ]] || { echo 'Certificate mode must be auto or selfsigned.' >&2;exit 1; }
renew=0; [[ ${1:-} != --renew ]] || renew=1
host=${CONNECT_HUB_DOMAIN:-}
if [[ -z $host ]]; then
 host=$(python3 - "$data/initial-access.txt" <<'PY'
import pathlib,sys,urllib.parse
values=dict(line.split('=',1)for line in pathlib.Path(sys.argv[1]).read_text().splitlines())
print(urllib.parse.urlparse(values['URL']).hostname)
PY
 )
fi
kind=$(python3 - "$host" <<'PY'
import ipaddress,re,sys
host=sys.argv[1]
try:
 ip=ipaddress.ip_address(host)
 print('ip' if ip.is_global else 'local')
except ValueError:
 if not re.fullmatch(r'(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?',host) or '..'in host:raise SystemExit('Invalid certificate hostname')
 print('domain')
PY
)
mkdir -p "$prefix/acme" "$prefix/tls"
chmod 0700 "$prefix/acme"; chmod 0750 "$prefix/tls"
chown root:connect-hub "$prefix/tls"
cat > "$prefix/acme/acme.sh" <<EOF
#!/usr/bin/env bash
for argument in "\$@";do
 if [[ \$argument == --upgrade ]];then echo 'The pinned ACME client is updated with Connect Hub releases.';exit 0;fi
done
exec bash "$prefix/current/hub/third-party/acme.sh" --home "$prefix/acme" --config-home "$prefix/acme" --cert-home "$prefix/acme/certs" "\$@"
EOF
chmod 0700 "$prefix/acme/acme.sh"
work=$(mktemp -d "$prefix/acme/work.XXXXXXXX")
listener=
cleanup(){ [[ -z $listener ]] || { kill "$listener" 2>/dev/null || true; wait "$listener" 2>/dev/null || true; }; rm -rf -- "$work"; }
trap cleanup EXIT
trusted=0
if [[ $mode == auto && $kind != local ]];then
 # Refuse occupied validation ports; never stop nginx, another panel or any foreign service.
 if python3 - <<'PY'
import socket
with socket.socket()as s:s.bind(('0.0.0.0',80))
PY
 then
  mkdir -p "$work/webroot/.well-known/acme-challenge"
  python3 -m http.server 80 --bind 0.0.0.0 --directory "$work/webroot" > "$work/http.log" 2>&1 & listener=$!
  sleep 1
  if kill -0 "$listener" 2>/dev/null;then
   acme=(bash "$prefix/current/hub/third-party/acme.sh" --home "$prefix/acme" --config-home "$prefix/acme" --cert-home "$prefix/acme/certs" --server letsencrypt)
   args=(--issue -d "$host" --webroot "$work/webroot" --keylength ec-256)
   [[ $kind != ip ]] || args+=(--certificate-profile shortlived --days 6)
   [[ -z ${CONNECT_HUB_ACME_EMAIL:-} ]] || "${acme[@]}" --register-account -m "$CONNECT_HUB_ACME_EMAIL" >> "$prefix/acme/issue.log" 2>&1 || true
   echo 'Requesting a trusted Let’s Encrypt certificate. External TCP port 80 must reach this server.'
   result=0; timeout 180 "${acme[@]}" "${args[@]}" >> "$prefix/acme/issue.log" 2>&1 || result=$?
   if ((result == 0 || result == 2)) &&
      "${acme[@]}" --install-cert -d "$host" --ecc --key-file "$work/key.pem" --fullchain-file "$work/cert.pem" >> "$prefix/acme/issue.log" 2>&1;then
    trusted=1
   fi
  fi
 else
  echo 'Certificate validation port 80 is occupied. Its owner was left running.' >&2
 fi
fi
if ((!trusted));then
 if ((renew)) && [[ -s $prefix/tls/fullchain.pem ]];then
  echo 'Trusted certificate renewal was not completed; existing certificate retained. See /opt/connect-hub/acme/issue.log.' >&2
  exit 1
 fi
 if [[ $kind == domain ]];then san="DNS:$host";else san="IP:$host";fi
 openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 30 -subj '/CN=Connect Hub temporary certificate' -addext "subjectAltName=$san,IP:127.0.0.1" -keyout "$work/key.pem" -out "$work/cert.pem" >/dev/null 2>&1
 echo 'HTTPS is enabled with a temporary self-signed certificate. The browser will warn until a trusted certificate is issued.' >&2
fi
# Verify key/certificate correspondence before replacing either live file.
openssl x509 -in "$work/cert.pem" -pubkey -noout > "$work/cert.pub"
openssl pkey -in "$work/key.pem" -pubout > "$work/key.pub"
cmp -s "$work/cert.pub" "$work/key.pub"
if ((renew)) && cmp -s "$work/cert.pem" "$prefix/tls/fullchain.pem" && cmp -s "$work/key.pem" "$prefix/tls/privkey.pem";then
 echo 'Certificate unchanged; panel restart is unnecessary.'
 exit 0
fi
install -o root -g connect-hub -m 0640 "$work/key.pem" "$prefix/tls/privkey.pem"
install -o root -g connect-hub -m 0640 "$work/cert.pem" "$prefix/tls/fullchain.pem"
if [[ ${XUI_IN_DOCKER:-false} == true ]];then
 export XUI_DB_TYPE=${XUI_DB_TYPE:-sqlite} XUI_DB_DSN=${XUI_DB_DSN:-} XUI_DB_FOLDER=$data
else
 export XUI_DB_TYPE=sqlite XUI_DB_DSN= XUI_DB_FOLDER=$data
fi
if [[ -f $data/panel.env ]];then
 while IFS='=' read -r key value;do
  case $key in XUI_DB_TYPE|XUI_DB_DSN) export "$key=$value";;esac
 done < "$data/panel.env"
fi
"$prefix/current/connect-hub" setting -webCert "$prefix/tls/fullchain.pem" -webCertKey "$prefix/tls/privkey.pem" >/dev/null
python3 - "$data/initial-access.txt" "$host" "$trusted" <<'PY'
import pathlib,sys,urllib.parse
p=pathlib.Path(sys.argv[1]);v=dict(line.split('=',1)for line in p.read_text().splitlines())
u=urllib.parse.urlparse(v['URL']);host=sys.argv[2]
if ':' in host:host=f'[{host}]'
v['URL']=urllib.parse.urlunparse(u._replace(scheme='https',netloc=f'{host}:{u.port}'))
v['LOCAL_URL']=urllib.parse.urlunparse(u._replace(scheme='https',netloc=f'127.0.0.1:{u.port}'))
v['CERTIFICATE']='trusted' if sys.argv[3]=='1' else 'temporary-self-signed'
p.write_text(''.join(f'{k}={value}\n'for k,value in v.items()));p.chmod(0o600)
PY
if [[ ${XUI_IN_DOCKER:-false} == true ]];then
 CONNECT_HUB_PREFIX="$prefix" CONNECT_HUB_DATA="$data" bash "$prefix/current/hub/container-renew.sh"
 if ((renew));then
  [[ -f /.dockerenv && $(readlink -f /proc/1/exe) == $(readlink -f "$prefix/current/connect-hub") ]] || { echo 'Refusing to signal an unrelated PID 1.' >&2;exit 1; }
  kill -HUP 1
 fi
 echo "Connect Hub certificate configured (trusted=$trusted); container renewal scheduled."
 exit 0
fi
CONNECT_HUB_PREFIX="$prefix" CONNECT_HUB_DATA="$data" bash "$prefix/current/hub/setup-renew.sh"
if ((renew));then systemctl restart connect-hub;fi
echo "Connect Hub certificate configured (trusted=$trusted)."

