#!/usr/bin/env bash
# Copy committed app/public/status into the host-mounted status/ tree.
# nginx prefers /var/atlas/status (gitignored) over the Vite dist copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/app/public/status"
DEST="${ROOT}/status"
if [[ ! -d "${SRC}" ]]; then
  echo "missing ${SRC}" >&2
  exit 1
fi
mkdir -p "${DEST}"
cp -a "${SRC}/." "${DEST}/"
echo "synced ${SRC} -> ${DEST}"
