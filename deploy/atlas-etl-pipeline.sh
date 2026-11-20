#!/usr/bin/env bash
# Weekly full pipeline on vpn-aplicaciones: live extract → release-dual → promote
# → transparency → panel → reload nginx volume trees.
# Alerts: non-zero exit (systemd OnFailure) + optional GitHub issue via check.env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${ATLAS_RELEASE_VERSION:-1.1.0}"
BY="${ATLAS_PROMOTE_BY:-ims-atlas-pipeline.timer}"
LOG_TAG="ims-atlas-pipeline"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

fail() {
  log "ERROR: $*"
  if [[ "${ATLAS_OPEN_GITHUB_ISSUE:-0}" == "1" ]]; then
    # Best-effort; never hide the original failure.
    docker run --rm \
      -v "$ROOT:/w" -w /w/etl \
      -e ATLAS_ROOT=/w \
      -e GH_TOKEN="${GH_TOKEN:-}" \
      -e GITHUB_TOKEN="${GITHUB_TOKEN:-}" \
      --network host \
      ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
      uv run atlas-etl check-alert --open-issue || true
  fi
  exit 1
}

run_etl() {
  local args=("$@")
  docker run --rm \
    -v "$ROOT:/w" -w /w/etl \
    -e ATLAS_ROOT=/w \
    --network host \
    ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
    uv run atlas-etl "${args[@]}"
}

log "start pipeline version=${VERSION}"
run_etl run --live --force || fail "atlas-etl run --live failed"
run_etl release-dual --version "$VERSION" --force || fail "release-dual failed"
run_etl promote "$VERSION" --by "$BY" --audience public --force || fail "promote public failed"
run_etl promote "$VERSION" --by "$BY" --audience internal --force || fail "promote internal failed"
run_etl export-transparency || fail "export-transparency failed"

docker run --rm \
  -v "$ROOT:/w" -w /w/etl \
  -e ATLAS_ROOT=/w \
  ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
  uv run python -c "from imsatlas_etl.export_col_hs64_panel import write_col_hs64_live_panel; print(write_col_hs64_live_panel(version='${VERSION}'))" \
  || fail "col_hs64 panel export failed"

./deploy/sync-public-status.sh || fail "sync-public-status failed"

# Reload nginx so newly written status/data are picked up (volume mounts).
if command -v docker >/dev/null 2>&1; then
  docker compose -f deploy/docker-compose.yml up -d || fail "compose up failed"
fi

log "pipeline OK (${LOG_TAG})"
exit 0
