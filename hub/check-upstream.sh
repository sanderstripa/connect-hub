#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
base=$(python3 -c 'import json;print(json.load(open("hub/upstream.json"))["revision"])')
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/MHSanaei/3x-ui.git
git fetch upstream main
git log --oneline "$base..upstream/main"
git diff --stat "$base" upstream/main
printf '\nReview these changes; merge upstream/main into a separate review branch, resolve conflicts, then run the full CI. Never reset the Connect Hub branch to upstream.\n'
