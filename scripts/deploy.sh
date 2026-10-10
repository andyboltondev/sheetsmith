#!/bin/bash
# Run on the cPanel server (by the Deploy workflow, or by hand over SSH) to update the live app.
# Usage: scripts/deploy.sh [tag]   (from the app root; no tag deploys the tip of main)
set -euo pipefail
cd "$(dirname "$0")/.."
tag="${1:-}"
if [ -n "$tag" ]; then git fetch --force origin "refs/tags/$tag:refs/tags/$tag"; git reset --hard "refs/tags/$tag"
else git fetch origin main; git reset --hard origin/main; fi
# cPanel's Node.js app page prints a "source .../activate" line; set NODE_ENV_ACTIVATE to it if auto-detect fails.
# The virtualenv lives at ~/nodevenv/<application root relative to home>/<node version>.
activate="${NODE_ENV_ACTIVATE:-$(ls -d "$HOME/nodevenv/${PWD#"$HOME"/}"/*/bin/activate 2>/dev/null | sort -V | tail -1)}"
[ -n "$activate" ] && source "$activate"
node --version
npm ci --omit=dev
mkdir -p tmp && touch tmp/restart.txt   # Passenger restarts the app on the next request
echo "Deployed ${tag:-main} ($(git rev-parse --short HEAD))"
