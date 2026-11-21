#!/usr/bin/env bash
# Weekly freshness check on vpn-aplicaciones (no tokens in this file).
# Optional: export GH_TOKEN or GITHUB_TOKEN in the systemd EnvironmentFile
# to open a GitHub issue when sources are stale (--open-issue).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FIXTURE="${ATLAS_FIXTURE_ROOT:-}"
OPEN_ISSUE_FLAG=()
if [[ "${ATLAS_OPEN_GITHUB_ISSUE:-0}" == "1" ]]; then
  OPEN_ISSUE_FLAG=(--open-issue)
fi

# Overlay resolved data path when repo data/ is a symlink (e.g. → /data/ims-atlas).
DATA_HOST="$(readlink -f "$ROOT/data")"
DATA_MOUNT=()
if [[ -d "$DATA_HOST" ]]; then
  DATA_MOUNT=(-v "$DATA_HOST:/w/data")
fi

if [[ -n "$FIXTURE" ]]; then
  docker run --rm \
    -v "$ROOT:/w" "${DATA_MOUNT[@]}" -w /w/etl \
    -e ATLAS_ROOT=/w \
    ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
    uv run atlas-etl check-alert --fixture-root "$FIXTURE" "${OPEN_ISSUE_FLAG[@]}"
else
  # Live probe (network). Falls back gracefully per-source inside check.
  docker run --rm \
    -v "$ROOT:/w" "${DATA_MOUNT[@]}" -w /w/etl \
    -e ATLAS_ROOT=/w \
    --network host \
    ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
    uv run atlas-etl check-alert "${OPEN_ISSUE_FLAG[@]}"
fi
