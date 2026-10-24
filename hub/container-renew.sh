#!/usr/bin/env bash
# Connect Hub: retain upstream container certificate renewal after recreation.
set -euo pipefail
prefix=${CONNECT_HUB_PREFIX:-/opt/connect-hub}
data=${CONNECT_HUB_DATA:-${XUI_DB_FOLDER:-/etc/connect-hub}}
[[ -s $prefix/tls/fullchain.pem && -s $prefix/tls/privkey.pem && -f $data/initial-access.txt ]] || exit 0
mkdir -p /etc/cron.d
printf '17 3,15 * * * root XUI_IN_DOCKER=true CONNECT_HUB_PREFIX=%q CONNECT_HUB_DATA=%q /bin/bash %q --renew\n' "$prefix" "$data" "$prefix/current/hub/cert.sh" > /etc/cron.d/connect-hub-cert-renew
chmod 0644 /etc/cron.d/connect-hub-cert-renew
pgrep -x cron >/dev/null || cron

