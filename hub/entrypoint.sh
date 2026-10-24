#!/bin/sh
set -eu
umask 077
mkdir -p "$XUI_DB_FOLDER" "$XUI_LOG_FOLDER"
python3 - <<'PY'
import os,pathlib
path=pathlib.Path(os.environ['XUI_DB_FOLDER'])/'panel.env'
values={}
if path.exists():
 for line in path.read_text().splitlines():
  if '=' in line:
   key,value=line.split('=',1);values[key]=value
for key,default in [('XUI_DB_TYPE','sqlite'),('XUI_DB_DSN','')]:
 value=os.environ.get(key,default)
 if '\n' in value or '\r' in value:raise SystemExit('Database environment values must be single-line')
 values[key]=value
path.write_text(''.join(key+'='+value+'\n' for key,value in values.items()));path.chmod(0o600)
PY
if [ ! -f "$XUI_DB_FOLDER/initial-access.txt" ];then
 user="hub-$(openssl rand -hex 4)";pass=$(openssl rand -hex 24);path="/$(openssl rand -hex 16)/"
 /app/connect-hub setting -username "$user" -password "$pass" -port 2053 -listenIP 0.0.0.0 -webBasePath "$path" -parallelTest
 printf 'URL=http://127.0.0.1:2053%s\nUSERNAME=%s\nPASSWORD=%s\n' "$path" "$user" "$pass" > "$XUI_DB_FOLDER/initial-access.txt"
 echo 'Fresh Connect Hub credentials saved to /etc/connect-hub/initial-access.txt'
fi
touch "$XUI_DB_FOLDER/.connect-hub-owned"
. /app/hub/container-upstream.sh
exec /app/connect-hub

