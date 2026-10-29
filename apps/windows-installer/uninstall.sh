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
# Fresh installs reserve this account; refuse an unrelated account before changing anything.
account=$(getent passwd connect-hub || true)
group=$(getent group connect-hub || true)
if [[ -n $account ]];then
 IFS=: read -r name pass uid gid gecos home login <<< "$account"
 [[ $name == connect-hub && $uid -gt 0 && $uid -lt 1000 && $home == /etc/connect-hub && $login == /usr/sbin/nologin ]] || fail
 IFS=: read -r group_name group_pass group_gid members <<< "$group"
 [[ $group_name == connect-hub && $group_gid == "$gid" && -z $members ]] || fail
elif [[ -n $group ]];then fail
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
# Remove the reserved service account so a fresh installation can reserve it again.
# No -r: only explicitly owned directories below may be removed.
if [[ -n $account ]];then userdel connect-hub;fi
if getent group connect-hub >/dev/null;then groupdel connect-hub;fi
# Keep external databases, BBR and swap intact.
rm -rf -- /opt/connect-hub /etc/connect-hub /var/log/connect-hub
if [[ -f /var/lib/connect-hub-installer/.connect-hub-owned ]];then rm -rf -- /var/lib/connect-hub-installer;fi
rm -f -- /usr/local/bin/connect-hub
printf 'CH_UNINSTALLED=1\n'
