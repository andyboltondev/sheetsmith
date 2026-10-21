#!/bin/bash
set -euo pipefail

deploy() {
  local tag="${1:?Provide a release tag}"
  [[ "$tag" =~ ^v[0-9A-Za-z.+-]+$ ]] || {
    echo "Invalid release tag"
    return 1
  }

  local app="/home/rezcloud/domains/sheetsmith.andybolton.dev/.repository"
  local repo="/home/rezcloud/domains/sheetsmith.andybolton.dev/sheetsmith.git"

  export GIT_SSH_COMMAND="ssh -i /home/rezcloud/.ssh/sheetsmith_github -o IdentitiesOnly=yes"

  git --git-dir="$repo" fetch origin \
    "refs/tags/$tag:refs/tags/$tag"

  git --git-dir="$repo" --work-tree="$app" \
    checkout --force "$tag"

  cd "$app"
  source /home/rezcloud/nodevenv/domains/sheetsmith.andybolton.dev/.repository/24/bin/activate

  npm ci --omit=dev --no-audit --no-fund
  mkdir -p tmp
  touch tmp/restart.txt

  echo "Deployed $tag"
}

deploy "$@"
