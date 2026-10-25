#!/usr/bin/env bash
# Connect Hub release bootstrap. Modified 2026-10-24. GPL-3.0.
set -Eeuo pipefail
umask 077
die(){ echo "Connect Hub: $*" >&2;exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || die 'This tested release requires Linux amd64 (x86_64).'
requested_version=
installer_args=()
for arg in "$@";do
 case "$arg" in
  --update|--no-service) installer_args+=("$arg");;
  v[0-9]*|[0-9]*) [[ -z $requested_version ]] || die 'Specify only one version';requested_version="v${arg#v}";;
  *) die 'Supported options: [VERSION] --update --no-service';;
 esac
done
export CONNECT_HUB_LANGUAGE=${CONNECT_HUB_LANGUAGE:-en}
printf '\nCONNECT. HUB\n\n'
if [[ " $* " != *' --update '* && -t 2 && -r /dev/tty ]] && { : </dev/tty; } 2>/dev/null;then
 printf '1. Русский   2. English [1]: ' >/dev/tty
 read -r language_choice </dev/tty || true
 if [[ ${language_choice:-1} == 1 ]];then export CONNECT_HUB_LANGUAGE=ru;else export CONNECT_HUB_LANGUAGE=en;fi
fi
if [[ -r /etc/os-release ]];then
 (. /etc/os-release; printf '%s %s' "$NAME" "${VERSION_ID:-}")
 printf ' · %s CPU · %s GB RAM · %s GB disk\n\n' "$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN)" "$(awk '/^MemTotal:/ {printf "%.2g", $2/1048576}' /proc/meminfo)" "$(df -kP / | awk 'NR==2 {printf "%.0f", $2/1048576}')"
 export CONNECT_HUB_INTRO_SHOWN=1
fi
runner=(bash)
if [[ $EUID != 0 && " $* " != *' --no-service '* ]];then
 command -v sudo >/dev/null || die 'Run from a root shell, or install sudo for your account.'
 sudo -v || die 'sudo authorization failed; run from a root shell.'
 runner=(sudo env "CONNECT_HUB_DOMAIN=${CONNECT_HUB_DOMAIN:-}" "CONNECT_HUB_ACME_EMAIL=${CONNECT_HUB_ACME_EMAIL:-}")
 if [[ -n ${CONNECT_HUB_TLS_MODE+x} ]];then runner+=("CONNECT_HUB_TLS_MODE=$CONNECT_HUB_TLS_MODE");fi
 for option in LANGUAGE HOST NONINTERACTIVE INTRO_SHOWN;do
  own_name=CONNECT_HUB_$option
  if [[ -n ${!own_name+x} ]];then runner+=("$own_name=${!own_name}");fi
 done
 runner+=(bash)
fi
missing=0
for tool in curl sha256sum tar python3 openssl realpath sysctl modprobe findmnt mkswap swapon swapoff;do command -v "$tool" >/dev/null || missing=1;done
if ((missing));then
 [[ " $* " != *' --no-service '* ]] || die 'Install curl, Python 3, OpenSSL, tar and coreutils before a user-only installation.'
 echo 'Installing required components / Установка необходимых компонентов...'
 "${runner[@]}" -s <<'DEPENDENCIES'
set -e
if command -v apt-get >/dev/null;then apt-get update;apt-get install -y curl ca-certificates python3 openssl tar coreutils procps kmod util-linux
elif command -v dnf >/dev/null;then dnf install -y curl ca-certificates python3 openssl tar coreutils procps-ng kmod util-linux
elif command -v yum >/dev/null;then yum install -y curl ca-certificates python3 openssl tar coreutils procps-ng kmod util-linux
elif command -v pacman >/dev/null;then pacman -Sy --noconfirm curl ca-certificates python openssl tar coreutils procps-ng kmod util-linux
elif command -v zypper >/dev/null;then zypper --non-interactive install curl ca-certificates python3 openssl tar coreutils procps kmod util-linux
else echo 'Install curl, ca-certificates, Python 3, OpenSSL, tar, coreutils, procps, kmod and util-linux with your OS package manager.' >&2;exit 1
fi
DEPENDENCIES
fi
for tool in curl sha256sum tar python3 openssl realpath sysctl modprobe findmnt mkswap swapon swapoff;do command -v "$tool" >/dev/null || die "Required tool missing after dependency installation: $tool";done
version=$(python3 - amd64 "$requested_version" <<'CONNECT_HUB_RELEASE_PY'
"""Resolve an installable Connect Hub GitHub release; never execute remote scripts."""
import json,re,sys,urllib.error,urllib.request

API='https://api.github.com/repos/sanderstripa/connect-hub/releases'
TAG=re.compile(r'v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?')

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Connect-Hub-updater','Accept':'application/vnd.github+json'}),timeout=30) as response:
        return json.load(response)

def installable(release,arch):
    tag=release.get('tag_name','')
    names={asset.get('name') for asset in release.get('assets',[])}
    return not release.get('draft') and bool(TAG.fullmatch(tag)) and {'SHA256SUMS',f'connect-hub-linux-{arch}.tar.gz'}<=names

def resolve(arch='amd64',tag='',fetch=get):
    if tag:
        if not TAG.fullmatch(tag) and tag!='dev-latest':raise ValueError('Invalid Connect Hub release tag')
        release=fetch(API+'/tags/'+tag)
        if tag=='dev-latest':
            if release.get('draft') or not {'SHA256SUMS',f'connect-hub-linux-{arch}.tar.gz'}<={a.get('name') for a in release.get('assets',[])}:raise ValueError('No installable Connect Hub development release')
        elif not installable(release,arch):raise ValueError('Release has no verified package for this architecture')
        return release['tag_name']
    try:
        stable=fetch(API+'/latest')
    except urllib.error.HTTPError as error:
        if error.code!=404:raise
    else:
        if installable(stable,arch):return stable['tag_name']
    # GitHub /latest excludes prereleases. During alpha, choose the newest
    # published installable prerelease, skipping drafts and partial uploads.
    for release in fetch(API+'?per_page=100'):
        if installable(release,arch):return release['tag_name']
    raise ValueError('No installable Connect Hub release is published')

if __name__=='__main__':
    try:print(resolve(sys.argv[1] if len(sys.argv)>1 else 'amd64',sys.argv[2] if len(sys.argv)>2 else ''))
    except Exception as error:raise SystemExit(f'Connect Hub release lookup failed: {error}')

CONNECT_HUB_RELEASE_PY
)
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
"${runner[@]}" "$tmp/connect-hub/hub/install.sh" --package "$archive" --sha256 "$checksum" "${installer_args[@]}"
