#!/usr/bin/env bash
# Connect Hub certificate lifecycle; original ACME renewals and user-selected paths.
set -euo pipefail
prefix=${CONNECT_HUB_PREFIX:-/opt/connect-hub}
data=${CONNECT_HUB_DATA:-${XUI_DB_FOLDER:-/etc/connect-hub}}
[[ $EUID == 0 && -f $data/.connect-hub-owned && -x $prefix/current/connect-hub ]] || exit 1
if [[ -x $prefix/acme/acme.sh ]];then
 "$prefix/acme/acme.sh" --cron || echo 'Some ACME renewals did not complete; existing certificates were retained.' >&2
fi
cert=$(XUI_DB_FOLDER="$data" "$prefix/current/connect-hub" setting -getCert true | sed -n 's/^cert: //p')
# A custom/manual certificate remains the operator's selection. The ACME job
# above renews its own configured outputs; the automatic installer path must
# never switch the panel back to a different certificate.
if [[ $cert == "$prefix/tls/fullchain.pem" ]];then
 CONNECT_HUB_PREFIX="$prefix" CONNECT_HUB_DATA="$data" bash "$prefix/current/hub/cert.sh" --renew
fi

