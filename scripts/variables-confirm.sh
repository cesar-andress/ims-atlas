#!/usr/bin/env bash
# Human verification of catalog variables (SPEC §4 status: verified).
# Run from the repo root — do NOT run from an agent:
#   BY=CA scripts/variables-confirm.sh
#
# For each draft variable: prints code, sources, licence decision, coverage and
# three sample values (when curated data exist) plus an upstream URL to check.
# Then wraps `atlas-etl verify` for that id. Already-verified variables are skipped.
set -euo pipefail
: "${BY:?set BY to your name or initials, e.g. BY=CA}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/etl"

uv run python - <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import yaml

from imsatlas_etl.gate import evidence_present
from imsatlas_etl.paths import repo_root
from imsatlas_etl.rights import gate_for_variable, load_deployment
from imsatlas_etl.sources import sources_by_id

root = repo_root()
catalog = yaml.safe_load((root / "catalog" / "variables.yaml").read_text(encoding="utf-8"))
registry = sources_by_id()
deployment = load_deployment()
curated = root / "data" / "curated" / "country_year.parquet"
panel = pd.read_parquet(curated) if curated.is_file() else None
vars_path = root / "data" / "curated" / "variables_country_year.parquet"
vpanel = pd.read_parquet(vars_path) if vars_path.is_file() else None

out = []
for var in catalog.get("variables") or []:
    if not isinstance(var, dict):
        continue
    vid = str(var.get("id") or "")
    if not vid:
        continue
    status = str(var.get("status") or "draft")
    if status == "verified":
        print(f"skip {vid} (already verified)")
        continue
    gate = gate_for_variable(var, registry=registry, deployment=deployment)
    sources = []
    for sid in var.get("source_ids") or []:
        src = registry.get(str(sid)) or {}
        rights = src.get("rights") or {}
        sources.append(
            {
                "id": sid,
                "use_research": rights.get("use_research"),
                "redistribute_raw": rights.get("redistribute_raw"),
                "licence": (rights.get("licence") or {}).get("id"),
                "evidence_ok": evidence_present(rights),
            }
        )
    code = var.get("code")
    samples = []
    frame = None
    if vpanel is not None and vid in vpanel.columns:
        frame = vpanel[["iso3", "year", vid]].dropna()
    elif panel is not None and code and str(code) in panel.columns:
        frame = panel[["iso3", "year", str(code)]].dropna().rename(columns={str(code): vid})
    if frame is not None and not frame.empty:
        for _, row in frame.head(3).iterrows():
            samples.append(
                {
                    "iso3": str(row["iso3"]),
                    "year": int(row["year"]),
                    "value": float(row[vid]),
                }
            )
    url = var.get("source_url") or (sources[0]["id"] if sources else None)
    block = {
        "id": vid,
        "code": code,
        "status": status,
        "gate": gate["decision"],
        "sources": sources,
        "coverage_rows": int(len(frame)) if frame is not None else 0,
        "samples": samples,
        "check_url": url,
    }
    out.append(block)
    print("---")
    print(json.dumps(block, indent=2, ensure_ascii=False))

Path("/tmp/atlas-variables-confirm-pending.json").write_text(
    json.dumps(out, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(f"\n{len(out)} draft variables pending. Review docs/variables-review.md.")
print("IDs:", " ".join(b["id"] for b in out))
PY

echo
echo "Confirm each id you accept (example):"
echo "  uv run atlas-etl verify <ID> --by \"$BY\""
echo "Or batch after review:"
PENDING="$(uv run python -c "import json; print(' '.join(x['id'] for x in json.load(open('/tmp/atlas-variables-confirm-pending.json'))))")"
if [[ -z "${PENDING}" ]]; then
  echo "Nothing to verify."
  exit 0
fi
echo "Pending: ${PENDING}"
echo "To verify ALL pending after human review:"
echo "  for id in ${PENDING}; do uv run atlas-etl verify \"\$id\" --by \"$BY\"; done"
