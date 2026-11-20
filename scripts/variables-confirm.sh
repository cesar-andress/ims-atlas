#!/usr/bin/env bash
# Human verification of catalog variables (SPEC §4 status: verified).
# Run from the repo root — do NOT run from an agent:
#   BY=CA scripts/variables-confirm.sh
#
# Prints a short review table (ship_raw sources first), then the batch verify
# command for the IDs César approves. Does not write verified itself.
set -euo pipefail
: "${BY:?set BY to your name or initials, e.g. BY=CA}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/etl"

uv run python - <<'PY'
from __future__ import annotations

import json
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

SHIP_FIRST = (
    "worldbank_wdi",
    "worldbank_wgi",
    "worldbank_lpi",
    "baci",
    "cepi_gravity",
    "wipo_gii",
    "inform_risk",
    "transparency_cpi",
    "worldbank_doing_business",
    "unctadstat",
    "imf_weo",
    "yale_epi",
    "fragile_states_index",
)

SAMPLE_ISOS = ("ESP", "COL", "DEU")
SAMPLE_YEAR = 2022


def sample_values(vid: str, code: object) -> list[dict]:
    samples: list[dict] = []
    frame = None
    if vpanel is not None and vid in vpanel.columns:
        frame = vpanel[["iso3", "year", vid]].dropna()
    elif panel is not None and code and str(code) in panel.columns:
        frame = (
            panel[["iso3", "year", str(code)]]
            .dropna()
            .rename(columns={str(code): vid})
        )
    if frame is None or frame.empty:
        return samples
    for iso in SAMPLE_ISOS:
        hit = frame[(frame["iso3"] == iso) & (frame["year"] == SAMPLE_YEAR)]
        if hit.empty:
            hit = frame[frame["iso3"] == iso].sort_values("year").tail(1)
        if hit.empty:
            continue
        row = hit.iloc[0]
        samples.append(
            {
                "iso3": str(row["iso3"]),
                "year": int(row["year"]),
                "value": float(row[vid]),
            }
        )
    if len(samples) < 3:
        for _, row in frame.head(3).iterrows():
            item = {
                "iso3": str(row["iso3"]),
                "year": int(row["year"]),
                "value": float(row[vid]),
            }
            if item not in samples:
                samples.append(item)
            if len(samples) >= 3:
                break
    return samples[:3]


def check_url(var: dict, sources: list[dict]) -> str:
    url = var.get("source_url") or var.get("upstream_url")
    if isinstance(url, str) and url.startswith("http"):
        return url
    for sid in var.get("source_ids") or []:
        src = registry.get(str(sid)) or {}
        for key in ("landing_url", "terms_url", "licence_url"):
            u = src.get(key)
            if isinstance(u, str) and u.startswith("http"):
                return u
    return sources[0]["id"] if sources else "UNKNOWN"


rows_out: list[dict] = []
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
    primary = str((var.get("source_ids") or ["?"])[0])
    name_es = (
        (var.get("name") or {}).get("es")
        if isinstance(var.get("name"), dict)
        else var.get("name_es") or var.get("label_es") or var.get("label") or vid
    )
    samples = sample_values(vid, var.get("code"))
    n_countries = n_years = 0
    if vpanel is not None and vid in vpanel.columns:
        sub = vpanel[["iso3", "year", vid]].dropna()
        n_countries = int(sub["iso3"].nunique())
        n_years = int(sub["year"].nunique())
    elif panel is not None and var.get("code") and str(var.get("code")) in panel.columns:
        sub = panel[["iso3", "year", str(var.get("code"))]].dropna()
        n_countries = int(sub["iso3"].nunique())
        n_years = int(sub["year"].nunique())
    rows_out.append(
        {
            "id": vid,
            "name_es": name_es,
            "code": var.get("code"),
            "primary_source": primary,
            "gate": gate["decision"],
            "ship_priority": primary in SHIP_FIRST,
            "n_countries": n_countries,
            "n_years": n_years,
            "samples": samples,
            "check_url": check_url(var, sources),
            "sources": sources,
        }
    )

rows_out.sort(key=lambda r: (not r["ship_priority"], r["id"]))

print()
print(
    f"{'id':<10} {'nombre_es':<32} {'fuente':<22} "
    f"{'ESP/COL/DEU':<36} url"
)
print("-" * 120)
for r in rows_out:
    samp = "; ".join(
        f"{s['iso3']}@{s['year']}={s['value']:.4g}" for s in r["samples"]
    ) or "(sin muestra)"
    name = str(r["name_es"])[:32]
    print(
        f"{r['id']:<10} {name:<32} {r['primary_source']:<22} "
        f"{samp:<36} {r['check_url']}"
    )

ship_ids = [r["id"] for r in rows_out if r["ship_priority"]]
other_ids = [r["id"] for r in rows_out if not r["ship_priority"]]
Path("/tmp/atlas-variables-confirm-pending.json").write_text(
    json.dumps(rows_out, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
Path("/tmp/atlas-variables-confirm-ship.json").write_text(
    json.dumps(ship_ids, indent=2) + "\n",
    encoding="utf-8",
)
print()
print(f"{len(rows_out)} draft variables. Ship-first group ({len(ship_ids)}): {' '.join(ship_ids)}")
print(f"Other ({len(other_ids)}): {' '.join(other_ids)}")
print("Review notes: docs/variables-review.md")
PY

SHIP_IDS="$(python3 -c "import json; print(' '.join(json.load(open('/tmp/atlas-variables-confirm-ship.json'))))")"
echo
echo "After you approve the ship-first group, run ONE command:"
if [[ -n "${SHIP_IDS}" ]]; then
  echo "  for id in ${SHIP_IDS}; do uv run atlas-etl verify \"\$id\" --by \"$BY\"; done"
else
  echo "  (no ship-first drafts left)"
fi
echo "Then rebuild the public release (weekly pipeline or release-dual + promote)."
