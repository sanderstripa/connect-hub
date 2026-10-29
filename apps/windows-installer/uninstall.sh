#!/usr/bin/env bash
# Remove only the default, managed Connect Hub installation. GPL-3.0.
set -euo pipefail
fail(){ echo 'UNINSTALL_REFUSED' >&2; exit 1; }
[[ $EUID == 0 ]] || fail
for dir in /opt/connect-hub /etc/connect-hub /var/log/connect-hub /var/lib/connect-hub-installer;do
 [[ ! -L $dir && $(realpath -m "$dir") == "$dir" ]] || fail
done
[[ -f /etc/connect-hub/.connect-hub-owned && ! -L /etc/connect-hub/.connect-hub-owned ]] || fail
[[ -L /opt/connect-hub/current ]] || fail
[[ $(realpath /opt/connect-hub/current) == /opt/connect-hub/releases/* ]] || fail
unit=/etc/systemd/system/connect-hub.service
[[ -f $unit && ! -L $unit ]] || fail
grep -qx '# Managed by Connect Hub' "$unit" || fail
grep -qx 'ExecStart=/opt/connect-hub/current/connect-hub' "$unit" || fail
grep -qx 'Environment=XUI_DB_FOLDER=/etc/connect-hub' "$unit" || fail
grep -qx 'Environment=XUI_LOG_FOLDER=/var/log/connect-hub' "$unit" || fail
for name in connect-hub-cert-renew.service connect-hub-cert-renew.timer;do
 file=/etc/systemd/system/$name
 [[ ! -L $file ]] || fail
 [[ ! -e $file ]] || grep -qx '# Managed by Connect Hub' "$file" || fail
done
if [[ -e /usr/local/bin/connect-hub || -L /usr/local/bin/connect-hub ]];then
 [[ ! -L /usr/local/bin/connect-hub ]] || fail
 grep -q 'Connect Hub modifications' /usr/local/bin/connect-hub || fail
fi
if [[ -e /var/lib/connect-hub-installer ]];then
 [[ -f /var/lib/connect-hub-installer/.connect-hub-owned ]] || fail
 # Never race a detached installation/update.
 if grep -q '"state":"running"' /var/lib/connect-hub-installer/job.*/state.json 2>/dev/null;then fail;fi
fi
# Stop renewal first so it cannot restart the panel during removal.
for name in connect-hub-cert-renew.timer connect-hub-cert-renew.service;do
 if [[ -f /etc/systemd/system/$name ]];then
  systemctl stop "$name"
  systemctl disable "$name"
 fi
done
systemctl stop connect-hub.service
systemctl disable connect-hub.service
rm -f -- /etc/systemd/system/connect-hub.service /etc/systemd/system/connect-hub-cert-renew.service /etc/systemd/system/connect-hub-cert-renew.timer
rm -rf -- /etc/systemd/system/connect-hub.service.d
systemctl daemon-reload
# Keep the service account, external databases, BBR and swap intact.
rm -rf -- /opt/connect-hub /etc/connect-hub /var/log/connect-hub
if [[ -f /var/lib/connect-hub-installer/.connect-hub-owned ]];then rm -rf -- /var/lib/connect-hub-installer;fi
rm -f -- /usr/local/bin/connect-hub
printf 'CH_UNINSTALLED=1\n'
