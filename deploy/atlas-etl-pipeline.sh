#!/usr/bin/env bash
# Hourly IMS Atlas pipeline tick (R-0): flock + per-source hourly check/extract.
# Full dual-release remains available via ATLAS_FULL_RELEASE=1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCK_DIR="${ATLAS_LOCK_DIR:-/var/lock}"
LOCK_FILE="${LOCK_DIR}/ims-atlas-pipeline.lock"
mkdir -p "$LOCK_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "skip: previous pipeline still running (flock)"
  exit 0
fi

VERSION="${ATLAS_RELEASE_VERSION:-1.2.0}"
BY="${ATLAS_PROMOTE_BY:-pipeline}"
LOG_TAG="ims-atlas-pipeline"
# Full BACI transforms / dual-release need headroom (host previously OOM'd).
ETL_MEMORY="${ATLAS_ETL_MEMORY:-24g}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

fail() {
  log "ERROR: $*"
  exit 1
}

run_etl() {
  local args=("$@")
  local env_args=()
  if [[ -f /etc/ims-atlas/check.env ]]; then
    env_args+=(--env-file /etc/ims-atlas/check.env)
  fi
  docker run --rm \
    --memory="$ETL_MEMORY" \
    -v "$ROOT:/w" -w /w/etl \
    -e ATLAS_ROOT=/w \
    "${env_args[@]}" \
    --network host \
    ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
    uv run atlas-etl "${args[@]}"
}

log "start hourly tick (${LOG_TAG})"
run_etl hourly || fail "atlas-etl hourly failed"

if [[ "${ATLAS_FULL_RELEASE:-0}" == "1" ]]; then
  log "full release requested"
  run_etl run --live --force || fail "atlas-etl run --live failed"
  run_etl release-dual --version "$VERSION" --force || fail "release-dual failed"
  run_etl promote "$VERSION" --by "$BY" --audience public --force || fail "promote public failed"
  run_etl promote "$VERSION" --by "$BY" --audience internal --force || fail "promote internal failed"
  run_etl export-transparency || fail "export-transparency failed"
fi

./deploy/sync-public-status.sh || fail "sync-public-status failed"

if command -v docker >/dev/null 2>&1; then
  docker compose -f deploy/docker-compose.yml up -d || fail "compose up failed"
fi

log "pipeline OK (${LOG_TAG})"
exit 0
