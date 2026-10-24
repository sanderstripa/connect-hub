#!/usr/bin/env bash
# Connect Hub modifications, 2026-10-24. GPL-3.0; upstream attribution in NOTICE.
# Sourced by the original upstream-derived management menu before dispatch.
export XUI_DB_FOLDER=/etc/connect-hub XUI_LOG_FOLDER=/var/log/connect-hub
export XUI_BIN_FOLDER=/opt/connect-hub/current/bin XUI_MAIN_FOLDER=/opt/connect-hub/current
install(){
 if [[ ${1:-} == -* ]];then command install "$@";return;fi
 curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash
}
update(){ curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash -s -- --update; }
update_dev(){ echo 'Development builds must pass the fork CI and review before installation.'; }
legacy_version(){ echo 'Use a retained Connect Hub backup; upstream binaries cannot replace this fork.'; }
replace_xui_script(){ command install -m 0755 /opt/connect-hub/current/x-ui.sh /usr/local/bin/connect-hub; }
update_shell(){ replace_xui_script; }
xui_env_file_path(){ echo /etc/connect-hub/panel.env; }
ssl_cert_issue_for_ip(){ bash /opt/connect-hub/current/hub/cert.sh; systemctl restart connect-hub; }
ssl_cert_issue(){
 local host
 read -rp 'Certificate IP or domain (empty = detected IP): ' host
 CONNECT_HUB_DOMAIN="$host" bash /opt/connect-hub/current/hub/cert.sh
 systemctl restart connect-hub
}
install_acme(){
 mkdir -p /opt/connect-hub/acme
 chmod 0700 /opt/connect-hub/acme
 cat > /opt/connect-hub/acme/acme.sh <<'ACME_WRAPPER'
#!/usr/bin/env bash
for argument in "$@";do
 if [[ $argument == --upgrade ]];then echo 'The pinned ACME client is updated with Connect Hub releases.';exit 0;fi
done
exec bash /opt/connect-hub/current/hub/third-party/acme.sh --home /opt/connect-hub/acme --config-home /opt/connect-hub/acme --cert-home /opt/connect-hub/acme/certs "$@"
ACME_WRAPPER
 chmod 0700 /opt/connect-hub/acme/acme.sh
}
uninstall(){
 confirm 'Remove Connect Hub service and retain its data in a backup?' 'n' || return 0
 [[ -f /etc/connect-hub/.connect-hub-owned ]] || { LOGE 'Not a managed Connect Hub installation';return 1; }
 systemctl stop connect-hub connect-hub-cert-renew.timer connect-hub-cert-renew.service || true
 systemctl disable connect-hub connect-hub-cert-renew.timer || true
 local backup="/var/backups/connect-hub/uninstall-$(date -u +%Y%m%dT%H%M%SZ)-$$"
 [[ -d /opt/connect-hub && ! -L /opt/connect-hub && ! -L /etc/connect-hub && ! -L /var/log/connect-hub ]] || { LOGE 'Unexpected installation paths';return 1; }
 command install -d -m 0700 "$backup"
 mv /etc/connect-hub "$backup/data"
 mv /opt/connect-hub "$backup/app"
 [[ ! -d /var/log/connect-hub ]] || mv /var/log/connect-hub "$backup/logs"
 for unit in connect-hub.service connect-hub-cert-renew.service connect-hub-cert-renew.timer;do
  local file="/etc/systemd/system/$unit"
  if [[ -f $file ]] && grep -q '^# Managed by Connect Hub$' "$file";then rm -- "$file";fi
 done
 systemctl daemon-reload
 userdel connect-hub || true
 if grep -q 'Connect Hub modifications' /usr/local/bin/connect-hub;then rm -- /usr/local/bin/connect-hub;fi
 echo "Removed only Connect Hub. Data, releases and backups retained in $backup."
 echo 'Reinstall: curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash'
}
