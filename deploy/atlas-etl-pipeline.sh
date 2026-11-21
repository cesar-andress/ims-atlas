#!/usr/bin/env bash
# IMS Atlas pipeline tick (R-0 hourly or full daily release).
#
# Hourly (default): flock non-blocking — skip if another tick holds the lock.
# Full release (ATLAS_FULL_RELEASE=1): blocking flock, then hourly extract →
# live run → release-dual → promote public+internal → export-transparency.
#
# Version: ATLAS_RELEASE_VERSION if set, else data/release/internal/CURRENT
# (never invent a version). Zenodo/GitHub tags are NOT uploaded/created here;
# release-dual only writes local .zenodo.dataset.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCK_DIR="${ATLAS_LOCK_DIR:-/var/lock}"
LOCK_FILE="${LOCK_DIR}/ims-atlas-pipeline.lock"
mkdir -p "$LOCK_DIR"

FULL_RELEASE=0
if [[ "${ATLAS_FULL_RELEASE:-0}" == "1" ]]; then
  FULL_RELEASE=1
fi

LOG_TAG="ims-atlas-pipeline"
if [[ "$FULL_RELEASE" -eq 1 ]]; then
  LOG_TAG="ims-atlas-daily"
fi
LOG_DIR="${ATLAS_LOG_DIR:-/var/log/ims-atlas}"
LOG_FILE="${ATLAS_LOG_FILE:-$LOG_DIR/${LOG_TAG}.log}"
mkdir -p "$LOG_DIR"

# Resolved host data path (repo may use data -> /data/ims-atlas symlink).
# Docker bind of ROOT alone leaves a broken symlink inside the container.
DATA_HOST="$(readlink -f "$ROOT/data")"

BY="${ATLAS_PROMOTE_BY:-pipeline}"
# Full BACI transforms / dual-release need headroom (host previously OOM'd).
ETL_MEMORY="${ATLAS_ETL_MEMORY:-24g}"
MIGRATE_WAIT_SEC="${ATLAS_MIGRATE_WAIT_SEC:-7200}"
MIGRATE_POLL_SEC="${ATLAS_MIGRATE_POLL_SEC:-30}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

fail() {
  log "ERROR: $*"
  exit 1
}

# Wait if a sibling migration / dual-release is still moving data.
wait_if_data_busy() {
  local deadline=$((SECONDS + MIGRATE_WAIT_SEC))
  while true; do
    local busy=0
    if pgrep -af 'rsync.*/(opt/services/ims-atlas/data|data/ims-atlas)' >/dev/null 2>&1; then
      busy=1
    fi
    if pgrep -af 'atlas-release-dual' >/dev/null 2>&1; then
      busy=1
    fi
    if [[ -e /var/lock/ims-atlas-migrate.lock ]] || [[ -e /data/ims-atlas/.atlas-migrate-in-progress ]]; then
      busy=1
    fi
    if [[ "$busy" -eq 0 ]]; then
      return 0
    fi
    if (( SECONDS >= deadline )); then
      fail "timeout waiting for data migration / atlas-release-dual (see flock + /data)"
    fi
    log "waiting: data migration or atlas-release-dual still running"
    sleep "$MIGRATE_POLL_SEC"
  done
}

resolve_version() {
  local env_v cur raw
  env_v="${ATLAS_RELEASE_VERSION:-}"
  env_v="${env_v#"${env_v%%[![:space:]]*}"}"
  env_v="${env_v%"${env_v##*[![:space:]]}"}"
  if [[ -n "$env_v" ]]; then
    printf '%s\n' "${env_v#v}"
    return 0
  fi
  cur="$DATA_HOST/release/internal/CURRENT"
  if [[ -f "$cur" ]]; then
    raw="$(tr -d '[:space:]' <"$cur")"
    raw="${raw#v}"
    if [[ -n "$raw" ]]; then
      printf '%s\n' "$raw"
      return 0
    fi
  fi
  fail "ATLAS_RELEASE_VERSION unset and $cur missing/empty (refusing to invent a version)"
}

run_etl() {
  local args=("$@")
  local env_args=()
  if [[ -f /etc/ims-atlas/check.env ]]; then
    env_args+=(--env-file /etc/ims-atlas/check.env)
  fi
  docker run --rm \
    --memory="$ETL_MEMORY" \
    -v "$ROOT:/w" \
    -v "$DATA_HOST:/w/data" \
    -w /w/etl \
    -e ATLAS_ROOT=/w \
    "${env_args[@]}" \
    --network host \
    ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
    uv run atlas-etl "${args[@]}"
}

exec 9>"$LOCK_FILE"
if [[ "$FULL_RELEASE" -eq 1 ]] || [[ "${ATLAS_PIPELINE_WAIT_LOCK:-0}" == "1" ]]; then
  # Daily (or explicit wait): block until hourly releases the lock.
  flock 9
else
  # Hourly: skip quietly if daily/full or another hourly holds the lock.
  if ! flock -n 9; then
    log "skip: previous pipeline still running (flock)"
    exit 0
  fi
fi

# Mirror stdout/stderr to log file while keeping journald capture.
exec > >(tee -a "$LOG_FILE") 2>&1

wait_if_data_busy

if [[ ! -d "$DATA_HOST" ]]; then
  fail "data host path missing: $DATA_HOST (ATLAS_ROOT=$ROOT)"
fi

if [[ "$FULL_RELEASE" -eq 1 ]]; then
  VERSION="$(resolve_version)"
  log "start full daily pipeline (${LOG_TAG}) version=${VERSION} data=${DATA_HOST}"
else
  VERSION=""
  log "start hourly tick (${LOG_TAG}) data=${DATA_HOST}"
fi

run_etl hourly || fail "atlas-etl hourly failed"

if [[ "$FULL_RELEASE" -eq 1 ]]; then
  log "full release: live run → release-dual → promote (v${VERSION})"
  run_etl run --live --force || fail "atlas-etl run --live failed"
  run_etl release-dual --version "$VERSION" --force || fail "release-dual failed"
  run_etl promote "$VERSION" --by "$BY" --audience public --force || fail "promote public failed"
  run_etl promote "$VERSION" --by "$BY" --audience internal --force || fail "promote internal failed"
  run_etl export-transparency || fail "export-transparency failed"
fi

./deploy/sync-public-status.sh || fail "sync-public-status failed"

# Fail loudly if CURRENT lags behind a fuller/newer release (empty or stale).
run_etl check-current --audience both || fail "CURRENT pointer unhealthy"

if command -v docker >/dev/null 2>&1; then
  docker compose -f deploy/docker-compose.yml up -d || fail "compose up failed"
fi

log "pipeline OK (${LOG_TAG})"
exit 0
