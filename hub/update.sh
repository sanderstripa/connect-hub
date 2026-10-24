#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Connect Hub update requires root.' >&2; exit 1; }
status=${XUI_UPDATE_STATUS_FILE:-/etc/connect-hub/update-status.json}
[[ $status == /etc/connect-hub/update-status.json && -f /etc/connect-hub/.connect-hub-owned ]] || { echo 'Managed Connect Hub installation required.' >&2; exit 1; }
finish() {
 local result=$?
 trap - EXIT
 python3 - "$status" "${XUI_UPDATE_RUN_ID:-}" "$result" <<'PY'
import json,os,pathlib,sys,time
path=pathlib.Path(sys.argv[1]);code=int(sys.argv[3])
temporary=path.with_suffix('.tmp')
temporary.write_text(json.dumps(dict(runId=sys.argv[2],state='success' if code==0 else 'failed',exitCode=code,finishedAt=int(time.time()))))
os.chmod(temporary,0o600);temporary.replace(path)
PY
 [[ -z ${temporary_dir:-} ]] || rm -rf -- "$temporary_dir"
 exit "$result"
}
trap finish EXIT
[[ -z ${XUI_UPDATE_TAG:-} ]] || { echo 'No tested development-channel release is available.' >&2; exit 1; }
version=v0.1.0-alpha.3
base=https://github.com/sanderstripa/connect-hub/releases/download/$version
temporary_dir=$(mktemp -d)
archive=$temporary_dir/connect-hub-linux-amd64.tar.gz
curl --fail --location --proto '=https' --proto-redir '=https' --retry 3 --output "$temporary_dir/SHA256SUMS" "$base/SHA256SUMS"
checksum=$(python3 - "$temporary_dir/SHA256SUMS" <<'PY'
import pathlib,re,sys
entries=[line.split() for line in pathlib.Path(sys.argv[1]).read_text().splitlines()]
matches=[p[0] for p in entries if len(p)==2 and p[1]=='connect-hub-linux-amd64.tar.gz']
if len(matches)!=1 or not re.fullmatch('[a-f0-9]{64}',matches[0]):raise SystemExit('Invalid release checksum manifest')
print(matches[0])
PY
)
curl --fail --location --proto '=https' --proto-redir '=https' --retry 3 --output "$archive" "$base/connect-hub-linux-amd64.tar.gz"
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status
tar -xzf "$archive" -C "$temporary_dir" connect-hub/hub/install.sh
bash "$temporary_dir/connect-hub/hub/install.sh" --package "$archive" --sha256 "$checksum" --update
