"""Hofstede 6-dimension matrix — live CSV from geerthofstede.com + fixture."""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import fetch_bytes, write_artifact
from imsatlas_etl.pipeline.io_paths import raw_source_dir

# Verified 2026-11-20: HTTP 200 text/csv (Geert Hofstede website archive).
CSV_URL = (
    "https://geerthofstede.com/wp-content/uploads/2016/08/"
    "6-dimensions-for-website-2015-08-16.csv"
)
DIMS = ("pdi", "idv", "mas", "uai", "ltowvs", "ivr")

# Publisher ``ctr`` codes → ISO3 (explicit; no fuzzy match). Regional blocs omitted.
CTR_TO_ISO3: dict[str, str] = {
    "ARG": "ARG",
    "AUL": "AUS",
    "AUT": "AUT",
    "BAN": "BGD",
    "BEL": "BEL",
    "BRA": "BRA",
    "BUL": "BGR",
    "CAN": "CAN",
    "CHL": "CHL",
    "CHI": "CHN",
    "COL": "COL",
    "COS": "CRI",
    "CRO": "HRV",
    "CZE": "CZE",
    "DEN": "DNK",
    "DOM": "DOM",
    "ECA": "ECU",
    "EGY": "EGY",
    "EST": "EST",
    "FIN": "FIN",
    "FRA": "FRA",
    "GBR": "GBR",
    "GER": "DEU",
    "GHA": "GHA",
    "GRE": "GRC",
    "GUA": "GTM",
    "HOK": "HKG",
    "HON": "HND",
    "HUN": "HUN",
    "IDO": "IDN",
    "IND": "IND",
    "IRA": "IRN",
    "IRE": "IRL",
    "IRQ": "IRQ",
    "ISR": "ISR",
    "ITA": "ITA",
    "JAM": "JAM",
    "JOR": "JOR",
    "JPN": "JPN",
    "KOR": "KOR",
    "KUW": "KWT",
    "LAT": "LVA",
    "LEB": "LBN",
    "LIB": "LBY",
    "LIT": "LTU",
    "LUX": "LUX",
    "MAL": "MYS",
    "MEX": "MEX",
    "MLT": "MLT",
    "MOR": "MAR",
    "NET": "NLD",
    "NIC": "NIC",
    "NIG": "NGA",
    "NOR": "NOR",
    "NZL": "NZL",
    "PAK": "PAK",
    "PAN": "PAN",
    "PER": "PER",
    "PHI": "PHL",
    "POL": "POL",
    "POR": "PRT",
    "ROM": "ROU",
    "RUS": "RUS",
    "SAF": "ZAF",
    "SAL": "SLV",
    "SAU": "SAU",
    "SER": "SRB",
    "SIN": "SGP",
    "SLK": "SVK",
    "SLV": "SVN",
    "SPA": "ESP",
    "SUR": "SUR",
    "SWE": "SWE",
    "SWI": "CHE",
    "SYR": "SYR",
    "TAI": "TWN",
    "THA": "THA",
    "TRI": "TTO",
    "TUR": "TUR",
    "UAE": "ARE",
    "URU": "URY",
    "USA": "USA",
    "VEN": "VEN",
    "VIE": "VNM",
}


def probe_version() -> dict[str, Any]:
    body, headers = fetch_bytes(CSV_URL, timeout=45.0)
    etag = headers.get("ETag") or headers.get("etag")
    modified = headers.get("Last-Modified") or headers.get("last-modified")
    tag = etag.strip('"')[:12] if etag else "2015-08-16"
    version = f"hofstede-{tag}"
    return {
        "upstream_version": version,
        "upstream_changed_at": modified,
        "note": "geerthofstede.com 6-dimensions CSV",
        "bytes": len(body),
    }


def live_version(*, root: Path | None = None) -> str:  # noqa: ARG001
    return str(probe_version()["upstream_version"])


def _parse_csv(body: bytes) -> pd.DataFrame:
    text = body.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    rows: list[dict[str, Any]] = []
    for raw in reader:
        ctr = (raw.get("ctr") or "").strip().upper()
        iso3 = CTR_TO_ISO3.get(ctr)
        if not iso3:
            continue
        out: dict[str, Any] = {"iso3": iso3}
        ok = True
        for dim in DIMS:
            val = (raw.get(dim) or "").strip()
            if not val or val.upper() in {"#NULL!", "NULL", "NA", "-"}:
                ok = False
                break
            try:
                out[dim] = float(val)
            except ValueError:
                ok = False
                break
        if ok:
            rows.append(out)
    if not rows:
        raise ValueError("hofstede: no country rows with complete dimensions")
    df = pd.DataFrame.from_records(rows)
    return df.drop_duplicates(subset=["iso3"], keep="last")


def extract_from_fixture(
    version: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = fixture_root / "hofstede" / "dimensions.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir("hofstede", version, root=root) / "dimensions.csv"
    if dest.is_file() and not force:
        return {
            "source": "hofstede",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url="fixture://hofstede/dimensions.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": "hofstede",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    dest = raw_source_dir("hofstede", version, root=root) / "dimensions.csv"
    if dest.is_file() and not force:
        return {
            "source": "hofstede",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    body, headers = fetch_bytes(CSV_URL, timeout=60.0)
    frame = _parse_csv(body)
    csv_bytes = frame.to_csv(index=False).encode("utf-8")
    meta = write_artifact(
        dest,
        csv_bytes,
        url=CSV_URL,
        headers=headers,
        extra_meta={
            "mode": "live",
            "version": version,
            "n_rows": int(len(frame)),
            "input": "geerthofstede_csv",
        },
    )
    return {
        "source": "hofstede",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
        "rows": int(len(frame)),
    }


def load_raw_dimensions(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"iso3": str})
    required = {"iso3", "pdi", "idv", "mas", "uai", "ltowvs", "ivr"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    return df
