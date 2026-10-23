#!/usr/bin/env bash
# Connect Hub release bootstrap. Modified 2026-10-24. GPL-3.0.
set -Eeuo pipefail
umask 077
die(){ echo "Connect Hub: $*" >&2;exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || die 'This tested release requires Linux amd64 (x86_64).'
for tool in curl sha256sum tar python3 openssl realpath;do command -v "$tool" >/dev/null || die "Required tool missing: $tool";done
for arg in "$@";do [[ $arg == --update || $arg == --no-service ]] || die 'Supported options: --update, --no-service';done
version=v0.1.0-alpha.2
base=https://github.com/sanderstripa/connect-hub/releases/download/$version
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
archive=$tmp/connect-hub-linux-amd64.tar.gz
echo "Downloading Connect Hub $version (Linux amd64)..."
curl --fail --location --proto '=https' --proto-redir '=https' --retry 3 --output "$tmp/SHA256SUMS" "$base/SHA256SUMS"
checksum=$(python3 - "$tmp/SHA256SUMS" <<'PY'
import pathlib,re,sys
entries=[line.split() for line in pathlib.Path(sys.argv[1]).read_text().splitlines()]
matches=[p[0] for p in entries if len(p)==2 and p[1]=='connect-hub-linux-amd64.tar.gz']
if len(matches)!=1 or not re.fullmatch('[a-f0-9]{64}',matches[0]):raise SystemExit('Invalid release checksum manifest')
print(matches[0])
PY
)
curl --fail --location --proto '=https' --proto-redir '=https' --retry 3 --output "$archive" "$base/connect-hub-linux-amd64.tar.gz"
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status || die 'Release checksum mismatch; nothing installed.'
tar -xzf "$archive" -C "$tmp" connect-hub/hub/install.sh
bash "$tmp/connect-hub/hub/install.sh" --package "$archive" --sha256 "$checksum" "$@"
