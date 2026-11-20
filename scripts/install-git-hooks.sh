#!/usr/bin/env bash
# Pin local author identity and enable .githooks/ for this clone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git config --local user.name "César Andrés"
git config --local user.email "cesar.andres@unir.net"
git config --local core.hooksPath .githooks

chmod +x .githooks/pre-commit .githooks/prepare-commit-msg .githooks/commit-msg

echo "install-git-hooks: core.hooksPath=.githooks; user=César Andrés <cesar.andres@unir.net>"
