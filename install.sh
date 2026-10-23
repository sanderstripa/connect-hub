#!/usr/bin/env bash
# Connect Hub, 2026-10-23. GPL-3.0.
set -euo pipefail
cd "$(dirname "$0")"
exec bash hub/install.sh "$@"
