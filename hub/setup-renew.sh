#!/usr/bin/env bash
# Install only this fork's certificate renewal service/timer.
set -euo pipefail
prefix=${CONNECT_HUB_PREFIX:-/opt/connect-hub}
data=${CONNECT_HUB_DATA:-${XUI_DB_FOLDER:-/etc/connect-hub}}
[[ $EUID == 0 && -f $data/.connect-hub-owned ]] || exit 1
if [[ ${XUI_IN_DOCKER:-false} == true ]];then
 CONNECT_HUB_PREFIX="$prefix" CONNECT_HUB_DATA="$data" bash "$prefix/current/hub/container-renew.sh"
 exit 0
fi
for unit in connect-hub-cert-renew.service connect-hub-cert-renew.timer;do
 file=/etc/systemd/system/$unit
 [[ ! -e $file ]] || grep -q '^# Managed by Connect Hub$' "$file" || { echo "Refusing foreign $unit" >&2;exit 1; }
done
cat > /etc/systemd/system/connect-hub-cert-renew.service <<EOF
# Managed by Connect Hub
[Unit]
Description=Renew only Connect Hub certificates
[Service]
Type=oneshot
Environment=CONNECT_HUB_PREFIX=$prefix
Environment=CONNECT_HUB_DATA=$data
ExecStart=/bin/bash $prefix/current/hub/renew.sh
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

