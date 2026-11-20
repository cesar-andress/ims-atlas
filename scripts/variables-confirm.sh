#!/usr/bin/env bash
# Human verification of catalog variables (SPEC §4 status: verified).
# Run from the repo root — do NOT run from an agent:
#   BY=CA scripts/variables-confirm.sh
#
# Prints a review table with samples for ALL variables (ship-first sources first),
# then the batch verify command for draft IDs César still needs to approve.
# Does not write verified itself.
set -euo pipefail
: "${BY:?set BY to your name or initials, e.g. BY=CA}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/etl"

uv run python - <<'PY'
from __future__ import annotations

import json
import re
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
curated = root / "data" / "curated"
panel = (
    pd.read_parquet(curated / "country_year.parquet")
    if (curated / "country_year.parquet").is_file()
    else None
)
vars_path = curated / "variables_country_year.parquet"
vpanel = pd.read_parquet(vars_path) if vars_path.is_file() else None
cp_path = curated / "country_product.parquet"
cpanel = pd.read_parquet(cp_path) if cp_path.is_file() else None
by_path = curated / "bilateral_year.parquet"
bpanel = pd.read_parquet(by_path) if by_path.is_file() else None

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

SAMPLE_ISOS = ("ESP", "COL", "DEU", "USA")
SAMPLE_YEAR = 2022
ORIGIN = "COL"
HS2 = "64"
WB_CODE_RE = re.compile(r"^[A-Z]{2}(?:\.[A-Z0-9]+)+$")

# Catalog code → column in bilateral_year.parquet
BILATERAL_CODE_MAP = {
    "distw": "distw",
    "distw_harmonic": "distw",
    "comlang_off": "comlang_off",
    "fta_wto": "fta_wto",
}

# Jose aliases without a dedicated code → open WDI series already in panel
ALIAS_CODES = {
    "INAN": "FP.CPI.TOTL.ZG",
    "UNRA": "SL.UEM.TOTL.ZS",
    "CLI": "PA.NUS.PRVT.PLI",
    "LPIN": "LP.LPI.OVRL.XQ",
}


def _codes(raw: object) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for part in re.split(r"[,/]", str(raw)):
        c = part.strip()
        if c:
            out.append(c)
    return out


def _append_sample(samples: list[dict], iso: str, year: int, value: float) -> None:
    item = {"iso3": iso, "year": int(year), "value": float(value)}
    if item not in samples:
        samples.append(item)


def sample_from_frame(
    frame: pd.DataFrame, value_col: str, *, iso_col: str = "iso3"
) -> list[dict]:
    samples: list[dict] = []
    if frame is None or frame.empty or value_col not in frame.columns:
        return samples
    sub = frame[[iso_col, "year", value_col]].dropna()
    if sub.empty:
        return samples
    for iso in SAMPLE_ISOS:
        hit = sub[(sub[iso_col] == iso) & (sub["year"] == SAMPLE_YEAR)]
        if hit.empty:
            hit = sub[sub[iso_col] == iso].sort_values("year").tail(1)
        if hit.empty:
            continue
        row = hit.iloc[0]
        _append_sample(samples, str(row[iso_col]), int(row["year"]), float(row[value_col]))
    if len(samples) < 3:
        for _, row in sub.head(6).iterrows():
            _append_sample(
                samples, str(row[iso_col]), int(row["year"]), float(row[value_col])
            )
            if len(samples) >= 3:
                break
    return samples[:3]


def sample_gov_mean() -> list[dict]:
    """GOV = mean of six WGI estimate series present in country_year."""
    dims = ["VA.EST", "PV.EST", "GE.EST", "RQ.EST", "RL.EST", "CC.EST"]
    if panel is None:
        return []
    present = [c for c in dims if c in panel.columns]
    if not present:
        return []
    tmp = panel[["iso3", "year", *present]].copy()
    tmp["GOV"] = tmp[present].mean(axis=1, skipna=True)
    return sample_from_frame(tmp, "GOV")


def sample_country_product(vid: str) -> list[dict]:
    if cpanel is None or "variable_id" not in cpanel.columns:
        return []
    sub = cpanel[
        (cpanel["variable_id"] == vid)
        & (cpanel["hs2"].astype(str) == HS2)
        & cpanel["value"].notna()
    ]
    if sub.empty:
        sub = cpanel[(cpanel["variable_id"] == vid) & cpanel["value"].notna()]
    samples: list[dict] = []
    for iso in ("ESP", "DEU", "USA"):
        hit = sub[sub["iso3"] == iso].sort_values("year").tail(1)
        if hit.empty:
            continue
        row = hit.iloc[0]
        _append_sample(samples, str(row["iso3"]), int(row["year"]), float(row["value"]))
    if len(samples) < 3:
        for _, row in sub.sort_values("year").tail(6).iterrows():
            _append_sample(
                samples, str(row["iso3"]), int(row["year"]), float(row["value"])
            )
            if len(samples) >= 3:
                break
    return samples[:3]


def sample_bilateral(code: str) -> list[dict]:
    col = BILATERAL_CODE_MAP.get(code, code)
    if bpanel is None or col not in bpanel.columns:
        return []
    sub = bpanel[
        (bpanel["origin"] == ORIGIN) & bpanel[col].notna()
    ][["destination", "year", col]].rename(
        columns={"destination": "iso3", col: "value"}
    )
    samples: list[dict] = []
    for iso in ("ESP", "DEU", "USA"):
        hit = sub[sub["iso3"] == iso].sort_values("year").tail(1)
        if hit.empty:
            continue
        row = hit.iloc[0]
        _append_sample(samples, str(row["iso3"]), int(row["year"]), float(row["value"]))
    return samples[:3]


def sample_from_raw_wdi_pages(code: str) -> tuple[list[dict], str | None]:
    """Fallback when a series was fetched as pages but not yet in indicators.csv.

    Returns (samples, error_note). error_note is set when WB archived/deleted the series.
    """
    pages = sorted(
        (root / "data" / "raw" / "worldbank_wdi").glob(f"*/pages/{code}_p*.json")
    )
    if not pages:
        return [], None
    rows: list[dict] = []
    archived_note: str | None = None
    for path in pages[:3]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            msg = payload[0].get("message")
            if isinstance(msg, list) and msg:
                text = str(msg[0].get("value") or msg[0])
                if "archived" in text.lower() or "not found" in text.lower():
                    archived_note = f"WB API: {text[:80]}"
        data = payload[1] if isinstance(payload, list) and len(payload) > 1 else payload
        if not isinstance(data, list):
            continue
        for item in data:
            if not isinstance(item, dict) or "value" not in item:
                continue
            iso = item.get("countryiso3code") or ""
            if not iso and isinstance(item.get("country"), dict):
                iso = str(item["country"].get("id") or "")
            if iso not in SAMPLE_ISOS:
                continue
            year = item.get("date")
            value = item.get("value")
            if year is None or value is None:
                continue
            try:
                rows.append(
                    {
                        "iso3": str(iso),
                        "year": int(year),
                        "value": float(value),
                    }
                )
            except (TypeError, ValueError):
                continue
    if not rows:
        return [], archived_note
    frame = pd.DataFrame(rows)
    return sample_from_frame(frame, "value"), None


def sample_values(var: dict) -> tuple[list[dict], str]:
    """Return (samples, note). note explains missing / alias / level."""
    vid = str(var.get("id") or "")
    level = str(var.get("level") or "country")
    codes = _codes(var.get("code"))
    if vid in ALIAS_CODES and ALIAS_CODES[vid] not in codes:
        codes = [ALIAS_CODES[vid], *codes]

    # 1) long variables panel
    if vpanel is not None and vid in vpanel.columns:
        s = sample_from_frame(vpanel, vid)
        if s:
            return s, "variables_country_year"

    # 2) country-product (BACI)
    if level in ("country_product", "bilateral_product") or vid in {
        "IMPV",
        "IMPC",
        "GRW",
        "HHI",
        "ASIASH",
        "REEXP",
        "PPAD",
        "UVGAP",
    }:
        s = sample_country_product(vid)
        if s:
            return s, f"country_product HS{HS2}"
        if level == "bilateral_product":
            return [], "bilateral_product panel missing (UVGAP/etc.)"
        return [], "not in country_product.parquet"

    # 3) bilateral (Gravity)
    if level == "bilateral" or any(c in BILATERAL_CODE_MAP for c in codes):
        for c in codes or list(BILATERAL_CODE_MAP):
            if c in BILATERAL_CODE_MAP or (bpanel is not None and c in bpanel.columns):
                s = sample_bilateral(c)
                if s:
                    return s, f"bilateral {ORIGIN}→dest"
        return [], "not in bilateral_year.parquet"

    # 4) GOV composite
    if vid == "GOV":
        s = sample_gov_mean()
        if s:
            return s, "mean of WGI dims in country_year"
        return [], "WGI dims missing from country_year.parquet"

    # 5) country_year by WB code
    if panel is not None:
        for c in codes:
            if c in panel.columns:
                s = sample_from_frame(panel, c)
                if s:
                    return s, f"country_year:{c}"
        # CADE catalog uses MT; panel may only have PC
        if vid == "CADE" and "EN.GHG.CO2.PC.CE.AR5" in panel.columns:
            s = sample_from_frame(panel, "EN.GHG.CO2.PC.CE.AR5")
            if s:
                return s, "country_year:EN.GHG.CO2.PC.CE.AR5 (proxy; MT not pivoted)"

    # 6) raw WDI page JSON (downloaded but not in indicators.csv)
    archived: str | None = None
    for c in codes:
        if WB_CODE_RE.match(c):
            s, err = sample_from_raw_wdi_pages(c)
            if s:
                return s, f"raw WDI pages:{c} (not in country_year yet)"
            if err:
                archived = err

    if not codes:
        return [], "no code in catalog / series not in panel"
    missing = ", ".join(codes)
    if archived:
        return [], archived
    return [], f"code(s) {missing} not in country_year.parquet"


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
    samples, sample_note = sample_values(var)
    n_countries = n_years = 0
    if vpanel is not None and vid in vpanel.columns:
        sub = vpanel[["iso3", "year", vid]].dropna()
        n_countries = int(sub["iso3"].nunique())
        n_years = int(sub["year"].nunique())
    elif panel is not None and var.get("code"):
        for c in _codes(var.get("code")):
            if c in panel.columns:
                sub = panel[["iso3", "year", c]].dropna()
                n_countries = int(sub["iso3"].nunique())
                n_years = int(sub["year"].nunique())
                break
    rows_out.append(
        {
            "id": vid,
            "name_es": name_es,
            "code": var.get("code"),
            "status": status,
            "primary_source": primary,
            "gate": gate["decision"],
            "ship_priority": primary in SHIP_FIRST,
            "n_countries": n_countries,
            "n_years": n_years,
            "samples": samples,
            "sample_note": sample_note,
            "check_url": check_url(var, sources),
            "sources": sources,
        }
    )

rows_out.sort(key=lambda r: (not r["ship_priority"], r["status"] != "draft", r["id"]))

print()
print(
    f"{'id':<10} {'st':<6} {'nombre_es':<28} {'fuente':<18} "
    f"{'muestra COL·HS64 / ESP…':<40} nota"
)
print("-" * 140)
for r in rows_out:
    samp = "; ".join(
        f"{s['iso3']}@{s['year']}={s['value']:.4g}" for s in r["samples"]
    ) or "(sin muestra)"
    name = str(r["name_es"])[:28]
    note = str(r["sample_note"])[:36]
    print(
        f"{r['id']:<10} {r['status']:<6} {name:<28} {r['primary_source']:<18} "
        f"{samp:<40} {note}"
    )

ship = [r for r in rows_out if r["ship_priority"]]
ship_missing = [r["id"] for r in ship if not r["samples"]]
draft_ship = [r["id"] for r in ship if r["status"] == "draft"]
other_draft = [
    r["id"] for r in rows_out if not r["ship_priority"] and r["status"] == "draft"
]
Path("/tmp/atlas-variables-confirm-pending.json").write_text(
    json.dumps(rows_out, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
Path("/tmp/atlas-variables-confirm-ship.json").write_text(
    json.dumps(draft_ship, indent=2) + "\n",
    encoding="utf-8",
)
print()
print(
    f"{len(rows_out)} variables ({sum(1 for r in rows_out if r['status']=='verified')} verified, "
    f"{sum(1 for r in rows_out if r['status']=='draft')} draft)."
)
print(
    f"Ship-first group: {len(ship)} · with sample: {len(ship)-len(ship_missing)} · "
    f"sin muestra: {ship_missing or 'ninguna'}"
)
print(f"Ship-first still draft ({len(draft_ship)}): {' '.join(draft_ship) or '(none)'}")
print(f"Other drafts ({len(other_draft)}): {' '.join(other_draft) or '(none)'}")
print("Review notes: docs/variables-review.md")
PY

SHIP_IDS="$(python3 -c "import json; print(' '.join(json.load(open('/tmp/atlas-variables-confirm-ship.json'))))")"
echo
echo "After you approve remaining ship-first drafts, run ONE command:"
if [[ -n "${SHIP_IDS}" ]]; then
  echo "  for id in ${SHIP_IDS}; do uv run atlas-etl verify \"\$id\" --by \"$BY\"; done"
else
  echo "  (no ship-first drafts left)"
fi
echo "Then rebuild the public release (daily pipeline or release-dual + promote)."
