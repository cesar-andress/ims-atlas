#!/usr/bin/env bash
# Copy committed app/public/status into the host-mounted status/ tree.
# nginx prefers the host status/ mount over the Vite dist copy.
#
# Preserve a host freshness.json that lists more sources (live EXTRA-4 check)
# so a deploy does not wipe soft «falta fichero» rows with a smaller snapshot.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/app/public/status"
DEST="${ROOT}/status"
if [[ ! -d "${SRC}" ]]; then
  echo "missing ${SRC}" >&2
  exit 1
fi
mkdir -p "${DEST}"
HOST_FRESH="${DEST}/freshness.json"
KEEP_FRESH=""
if [[ -f "${HOST_FRESH}" ]]; then
  KEEP_FRESH="$(mktemp)"
  cp -a "${HOST_FRESH}" "${KEEP_FRESH}"
fi
cp -a "${SRC}/." "${DEST}/"
if [[ -n "${KEEP_FRESH}" && -f "${KEEP_FRESH}" ]]; then
  python3 - "${KEEP_FRESH}" "${DEST}/freshness.json" <<'PY' || true
import json
import sys
from pathlib import Path

keep, dest = Path(sys.argv[1]), Path(sys.argv[2])
try:
    a = json.loads(keep.read_text(encoding="utf-8"))
    b = json.loads(dest.read_text(encoding="utf-8")) if dest.is_file() else {"sources": []}
except Exception:
    raise SystemExit(0)
na = len(a.get("sources") or [])
nb = len(b.get("sources") or [])
if na > nb:
    dest.write_text(json.dumps(a, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"restored host freshness ({na} > {nb} sources)", flush=True)
PY
  rm -f "${KEEP_FRESH}"
fi
echo "synced ${SRC} -> ${DEST}"
