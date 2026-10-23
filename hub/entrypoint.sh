#!/bin/sh
set -eu
umask 077
mkdir -p "$XUI_DB_FOLDER" "$XUI_LOG_FOLDER"
if [ ! -f "$XUI_DB_FOLDER/connect-hub.db" ];then
 user="hub-$(openssl rand -hex 4)";pass=$(openssl rand -hex 24);path="/$(openssl rand -hex 16)/"
 /app/connect-hub setting -username "$user" -password "$pass" -port 2053 -listenIP 0.0.0.0 -webBasePath "$path" -parallelTest
 printf 'URL=http://127.0.0.1:2053%s\nUSERNAME=%s\nPASSWORD=%s\n' "$path" "$user" "$pass" > "$XUI_DB_FOLDER/initial-access.txt"
 echo 'Fresh Connect Hub credentials saved to /etc/connect-hub/initial-access.txt'
fi
exec /app/connect-hub
