#!/usr/bin/env bash
# Prepare (or apply) redistributable:true flips for variables César confirms.
# Default: --dry-run (never writes). Do NOT run without --apply after César OK.
#
# Usage:
#   ./scripts/vars-redistribute-confirm.sh
#   ./scripts/vars-redistribute-confirm.sh --apply   # César only, after review
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLY=0
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
fi

VARS=(PPAD CIBC LPIN CPTR CLI INAN UNRA INRI CPIN)

echo "=== vars-redistribute-confirm (dry-run=$([[ $APPLY -eq 0 ]] && echo yes || echo NO)) ==="
echo "Catalog: $ROOT/catalog/variables.yaml"
echo
echo "Evidence checklist (fill / verify before --apply):"
echo "  PPAD  — BACI-derived; needs quantity q; currently empty in panel."
echo "  CIBC  — World Bank Doing Business archive; confirm indicator licence."
echo "  LPIN  — exact copy of LPI (already public); prefer keep LPI only."
echo "  CPTR  — WDI third-party (Lloyd's List container port); check WDI meta API."
echo "  CLI   — exact copy of PLI; prefer keep PLI only."
echo "  INAN  — exact copy of INFL; prefer keep INFL only."
echo "  UNRA  — exact copy of UNEMP; prefer keep UNEMP only."
echo "  INRI  — INFORM Risk; notes say licence UNKNOWN — verify INFORM licence page."
echo "  CPIN  — Transparency International CPI; notes say UNKNOWN — verify TI terms."
echo
echo "WDI metadata API (per indicator), INFORM licence, TI reuse terms: open in browser;"
echo "paste DOI/URL into catalog/RIGHTS.md before flipping redistributable."
echo

python3 - "$ROOT" "$APPLY" "${VARS[@]}" <<'PY'
import sys
from pathlib import Path
import re

root = Path(sys.argv[1])
apply = sys.argv[2] == "1"
ids = sys.argv[3:]
path = root / "catalog" / "variables.yaml"
text = path.read_text(encoding="utf-8")

for vid in ids:
    # Catalog uses quoted YAML: - 'id': 'PPAD' … 'redistributable': false
    pat = re.compile(
        rf"(^- 'id': '{re.escape(vid)}'\n(?:  .*\n)*?  'redistributable': )(false|true)",
        re.MULTILINE,
    )
    m = pat.search(text)
    if not m:
        print(f"{vid}: NOT FOUND in catalog")
        continue
    cur = m.group(2)
    print(f"{vid}: redistributable={cur} → would set true")
    if apply and cur != "true":
        text = pat.sub(rf"\1true", text, count=1)

if apply:
    path.write_text(text, encoding="utf-8")
    print(f"WROTE {path}")
else:
    print("DRY-RUN: no write. Re-run with --apply after César confirms each licence.")
PY
