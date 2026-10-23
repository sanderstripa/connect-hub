#!/usr/bin/env bash
# Connect Hub intentionally does not run upstream's system management menu.
set -euo pipefail
echo 'This checkout is Connect Hub. Existing x-ui services are never managed.' >&2
echo 'Use hub/install.sh for isolated installation/update and the Connect Hub UI.' >&2
exit 1
