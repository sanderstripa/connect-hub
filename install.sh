#!/usr/bin/env bash
# Connect Hub release bootstrap. Modified 2026-10-24. GPL-3.0.
set -Eeuo pipefail
umask 077
die(){ echo "Connect Hub: $*" >&2;exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || die 'This tested release requires Linux amd64 (x86_64).'
for arg in "$@";do [[ $arg == --update || $arg == --no-service ]] || die 'Supported options: --update, --no-service';done
runner=(bash)
if [[ $EUID != 0 && " $* " != *' --no-service '* ]];then
 command -v sudo >/dev/null || die 'Run from a root shell, or install sudo for your account.'
 runner=(sudo env "CONNECT_HUB_DOMAIN=${CONNECT_HUB_DOMAIN:-}" "CONNECT_HUB_ACME_EMAIL=${CONNECT_HUB_ACME_EMAIL:-}")
 if [[ -n ${CONNECT_HUB_TLS_MODE+x} ]];then runner+=("CONNECT_HUB_TLS_MODE=$CONNECT_HUB_TLS_MODE");fi
 runner+=(bash)
fi
missing=0
for tool in curl sha256sum tar python3 openssl realpath;do command -v "$tool" >/dev/null || missing=1;done
if ((missing));then
 [[ " $* " != *' --no-service '* ]] || die 'Install curl, Python 3, OpenSSL, tar and coreutils before a user-only installation.'
 echo 'Installing required components / Установка необходимых компонентов...'
 "${runner[@]}" -s <<'DEPENDENCIES'
set -e
if command -v apt-get >/dev/null;then apt-get update;apt-get install -y curl ca-certificates python3 openssl tar coreutils
elif command -v dnf >/dev/null;then dnf install -y curl ca-certificates python3 openssl tar coreutils
elif command -v yum >/dev/null;then yum install -y curl ca-certificates python3 openssl tar coreutils
elif command -v pacman >/dev/null;then pacman -Sy --noconfirm curl ca-certificates python openssl tar coreutils
elif command -v zypper >/dev/null;then zypper --non-interactive install curl ca-certificates python3 openssl tar coreutils
else echo 'Install curl, ca-certificates, Python 3, OpenSSL, tar and coreutils with your OS package manager.' >&2;exit 1
fi
DEPENDENCIES
fi
for tool in curl sha256sum tar python3 openssl realpath;do command -v "$tool" >/dev/null || die "Required tool missing after dependency installation: $tool";done
version=v0.1.0-alpha.3
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
"${runner[@]}" "$tmp/connect-hub/hub/install.sh" --package "$archive" --sha256 "$checksum" "$@"
