#!/usr/bin/env bash
# IMS Atlas pipeline tick (R-0 hourly or full daily release).
#
# Hourly (default): flock non-blocking — skip if another tick holds the lock.
# Full release (ATLAS_FULL_RELEASE=1): blocking flock, then hourly extract →
# live run → optional NEW internal patch version (never overwrite) →
# promote internal only. Public promote requires ATLAS_PROMOTE_PUBLIC=1
# (never set on the daily timer; César only).
#
# Version: ATLAS_RELEASE_VERSION if set, else next patch from
# data/release/internal/CURRENT when sources changed. Never invent a major/minor.
# Never rewrite an existing vX.Y.Z tree (--force no longer overwrites).
#
# ATLAS_DRY_RUN=1: print the plan and exit 0 (no docker ETL / promote).
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

DRY_RUN=0
if [[ "${ATLAS_DRY_RUN:-0}" == "1" ]]; then
  DRY_RUN=1
fi

LOG_TAG="ims-atlas-pipeline"
if [[ "$FULL_RELEASE" -eq 1 ]]; then
  LOG_TAG="ims-atlas-daily"
fi
LOG_DIR="${ATLAS_LOG_DIR:-/var/log/ims-atlas}"
LOG_FILE="${ATLAS_LOG_FILE:-$LOG_DIR/${LOG_TAG}.log}"
mkdir -p "$LOG_DIR"

# Resolved host data path (repo may use data -> /data/ims-atlas symlink).
DATA_HOST="$(readlink -f "$ROOT/data")"

BY="${ATLAS_PROMOTE_BY:-pipeline}"
ETL_MEMORY="${ATLAS_ETL_MEMORY:-24g}"
MIGRATE_WAIT_SEC="${ATLAS_MIGRATE_WAIT_SEC:-7200}"
MIGRATE_POLL_SEC="${ATLAS_MIGRATE_POLL_SEC:-30}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

fail() {
  log "ERROR: $*"
  exit 1
}

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

strip_v() {
  local raw="$1"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  raw="${raw#v}"
  printf '%s\n' "$raw"
}

read_current_version() {
  local audience="$1"
  local cur="$DATA_HOST/release/${audience}/CURRENT"
  if [[ -f "$cur" ]]; then
    strip_v "$(tr -d '[:space:]' <"$cur")"
    return 0
  fi
  return 1
}

bump_patch() {
  local ver="$1"
  local a b c
  IFS=. read -r a b c <<<"$ver"
  if [[ -z "${a:-}" || -z "${b:-}" || -z "${c:-}" ]]; then
    fail "cannot bump non-semver version: $ver"
  fi
  printf '%s.%s.%s\n' "$a" "$b" "$((c + 1))"
}

# Compare manifest source_versions (internal CURRENT) to status/freshness.json.
# Exit 0 if changed (need new release), 1 if unchanged.
sources_changed_vs_current() {
  local cur_ver="$1"
  local man="$DATA_HOST/release/internal/v${cur_ver}/manifest.json"
  local fresh="$DATA_HOST/../status/freshness.json"
  # status lives under ATLAS_ROOT/status, not under data/
  fresh="$ROOT/status/freshness.json"
  if [[ ! -f "$man" ]]; then
    log "sources_changed: no internal manifest for v${cur_ver} → treat as changed"
    return 0
  fi
  if [[ ! -f "$fresh" ]]; then
    log "sources_changed: no status/freshness.json → treat as changed"
    return 0
  fi
  python3 - "$man" "$fresh" <<'PY'
import json, sys
man_path, fresh_path = sys.argv[1], sys.argv[2]
man = json.loads(open(man_path, encoding="utf-8").read())
fresh = json.loads(open(fresh_path, encoding="utf-8").read())
def norm(v: object) -> str:
    s = "" if v is None else str(v).strip()
    if s in {"None", "null", "NULL"}:
        return ""
    return s

old = {str(k): norm(v) for k, v in (man.get("source_versions") or {}).items()}
new = {}
for row in fresh.get("sources") or []:
    sid = str(row.get("source") or "")
    if not sid:
        continue
    new[sid] = norm(row.get("ingested_version") or row.get("upstream_version") or "")
keys = set(old) | set(new)
changed = False
for k in sorted(keys):
    ov, nv = old.get(k, ""), new.get(k, "")
    if ov != nv:
        changed = True
        print(f"CHANGED {k}: {ov!r} -> {nv!r}")
if not changed:
    print("UNCHANGED source_versions vs freshness")
    sys.exit(1)
sys.exit(0)
PY
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

plan_full_release() {
  local cur_internal cur_public next_ver
  cur_internal="$(read_current_version internal || true)"
  cur_public="$(read_current_version public || true)"
  if [[ -z "$cur_internal" ]]; then
    fail "internal CURRENT missing; cannot plan daily release"
  fi

  if [[ -n "${ATLAS_RELEASE_VERSION:-}" ]]; then
    next_ver="$(strip_v "$ATLAS_RELEASE_VERSION")"
    log "plan: ATLAS_RELEASE_VERSION override → ${next_ver}"
  else
    next_ver="$(bump_patch "$cur_internal")"
  fi

  log "plan: internal CURRENT=v${cur_internal} public CURRENT=v${cur_public:-none}"
  log "plan: candidate next internal patch=v${next_ver}"

  if [[ -d "$DATA_HOST/release/internal/v${next_ver}" ]]; then
    log "plan: REFUSE — internal v${next_ver} already exists (immutable; no overwrite)"
    return 2
  fi
  if [[ -d "$DATA_HOST/release/staging/internal/v${next_ver}" ]]; then
    log "plan: REFUSE — staging/internal/v${next_ver} already exists"
    return 2
  fi

  if sources_changed_vs_current "$cur_internal"; then
    log "plan: sources CHANGED vs internal v${cur_internal} → would create internal v${next_ver}"
  else
    log "plan: sources UNCHANGED → would SKIP creating a new version"
    return 3
  fi

  log "plan: would run: atlas-etl run --live --force"
  log "plan: would run: atlas-etl release --version ${next_ver} --audience internal (NO --force overwrite)"
  log "plan: would run: atlas-etl promote ${next_ver} --audience internal --by ${BY}"
  if [[ "${ATLAS_PROMOTE_PUBLIC:-0}" == "1" ]]; then
    log "plan: ATLAS_PROMOTE_PUBLIC=1 → would ALSO release+promote PUBLIC v${next_ver} (manual César only)"
  else
    log "plan: would NOT promote public (ATLAS_PROMOTE_PUBLIC unset; timer must never set it)"
  fi
  log "plan: would NOT touch existing v${cur_internal} or public v${cur_public:-none} trees"
  return 0
}

exec 9>"$LOCK_FILE"
if [[ "$FULL_RELEASE" -eq 1 ]] || [[ "${ATLAS_PIPELINE_WAIT_LOCK:-0}" == "1" ]]; then
  flock 9
else
  if ! flock -n 9; then
    log "skip: previous pipeline still running (flock)"
    exit 0
  fi
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

wait_if_data_busy

if [[ ! -d "$DATA_HOST" ]]; then
  fail "data host path missing: $DATA_HOST (ATLAS_ROOT=$ROOT)"
fi

if [[ "$FULL_RELEASE" -eq 1 ]]; then
  log "start full daily pipeline (${LOG_TAG}) data=${DATA_HOST} dry_run=${DRY_RUN}"
  set +e
  plan_full_release
  plan_rc=$?
  set -e
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY_RUN=1 → stop after plan (rc=${plan_rc}; 0=would release, 2=refuse exists, 3=skip unchanged)"
    exit 0
  fi
  if [[ "$plan_rc" -eq 3 ]]; then
    log "no source changes → skip release/promote; sync status only"
    run_etl hourly || fail "atlas-etl hourly failed"
    ./deploy/sync-public-status.sh || fail "sync-public-status failed"
    run_etl check-current --audience both || fail "CURRENT pointer unhealthy"
    log "pipeline OK (${LOG_TAG}) — no new version"
    exit 0
  fi
  if [[ "$plan_rc" -eq 2 ]]; then
    fail "planned next version already exists; refusing overwrite"
  fi
  if [[ "$plan_rc" -ne 0 ]]; then
    fail "plan_full_release failed rc=${plan_rc}"
  fi
else
  log "start hourly tick (${LOG_TAG}) data=${DATA_HOST}"
fi

run_etl hourly || fail "atlas-etl hourly failed"

if [[ "$FULL_RELEASE" -eq 1 ]]; then
  cur_internal="$(read_current_version internal)"
  if [[ -n "${ATLAS_RELEASE_VERSION:-}" ]]; then
    VERSION="$(strip_v "$ATLAS_RELEASE_VERSION")"
  else
    VERSION="$(bump_patch "$cur_internal")"
  fi
  log "full release: live run → internal release+promote v${VERSION} (immutable)"
  run_etl run --live --force || fail "atlas-etl run --live failed"
  # Never pass a force that overwrites an existing tree — ETL refuses anyway.
  run_etl release --version "$VERSION" --audience internal || fail "release internal failed"
  run_etl promote "$VERSION" --by "$BY" --audience internal || fail "promote internal failed"

  if [[ "${ATLAS_PROMOTE_PUBLIC:-0}" == "1" ]]; then
    log "ATLAS_PROMOTE_PUBLIC=1: public release+promote v${VERSION}"
    run_etl release --version "$VERSION" --audience public || fail "release public failed"
    run_etl promote "$VERSION" --by "$BY" --audience public || fail "promote public failed"
  else
    log "skip public promote (set ATLAS_PROMOTE_PUBLIC=1 manually; never on timer)"
  fi
  run_etl export-transparency || fail "export-transparency failed"
fi

./deploy/sync-public-status.sh || fail "sync-public-status failed"
run_etl check-current --audience both || fail "CURRENT pointer unhealthy"

if [[ "$DRY_RUN" -eq 0 ]] && command -v docker >/dev/null 2>&1; then
  docker compose -f deploy/docker-compose.yml up -d || fail "compose up failed"
fi

log "pipeline OK (${LOG_TAG})"
exit 0
