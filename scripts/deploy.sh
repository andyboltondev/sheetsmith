#!/bin/bash
# Run on the cPanel server (by the Deploy workflow, or by hand over SSH) to update the live app.
# Usage: scripts/deploy.sh [tag]   (from the app root; no tag deploys the tip of main)
set -eo pipefail
# Everything runs inside a function so bash has read the whole script before git replaces this file.
deploy() {
  cd "$(dirname "$0")/.."
  local tag="${1:-}"
  if [ -n "$tag" ]; then git fetch --force origin "refs/tags/$tag:refs/tags/$tag"; git reset --hard "refs/tags/$tag"
  else git fetch origin main; git reset --hard origin/main; fi
  # cPanel's Node.js app page prints a "source .../activate" line; set NODE_ENV_ACTIVATE to it if auto-detect fails.
  # The virtualenv lives at ~/nodevenv/<application root relative to home>/<node version>.
  local activate="${NODE_ENV_ACTIVATE:-$(ls -d "$HOME/nodevenv/${PWD#"$HOME"/}"/*/bin/activate 2>/dev/null | sort -V | tail -1)}"
  if [ -n "$activate" ]; then source "$activate"; fi
  node --version
  npm ci --omit=dev --no-audit --no-fund
  mkdir -p tmp && touch tmp/restart.txt   # Passenger restarts the app on the next request
  # Some cPanel hosts ignore restart.txt and keep the old process, so also kill it (the old process ignores SIGTERM); Passenger starts a fresh one on the next request.
  pkill -9 -u "$(id -u)" -f "lsnode:$PWD" || true
  echo "Deployed ${tag:-main} ($(git rev-parse --short HEAD))"
}
deploy "$@"
exit
