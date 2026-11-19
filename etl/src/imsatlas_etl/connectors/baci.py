"""BACI trade connector (fixture + manual zip drop; never downloads)."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import write_artifact, write_file_meta
from imsatlas_etl.connectors.manual import (
    find_drop,
    load_pin,
    manual_version,
    safe_extract,
    verify_pin,
)
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

CHUNK_ROWS = 500_000
# BACI reports trade values in thousands of current USD (CEPII documentation);
# override with pin options.value_scale if a release states otherwise.
DEFAULT_VALUE_SCALE = 1000.0


def extract_from_fixture(
    version: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = fixture_root / "baci" / "trade.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir("baci", version, root=root) / "trade.csv"
    if dest.is_file() and not force:
        return {
            "source": "baci",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url="fixture://baci/trade.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": "baci",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def load_raw_trade(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"hs6": str, "exporter": str, "importer": str})
    required = {"year", "exporter", "importer", "hs6", "value_usd"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    df["year"] = df["year"].astype(int)
    df["hs6"] = df["hs6"].str.zfill(6)
    df["hs4"] = df["hs6"].str.slice(0, 4)
    df["hs2"] = df["hs6"].str.slice(0, 2)
    return df


def country_code_map(path: Path) -> dict[str, str]:
    """BACI numeric country code -> ISO3 from the zip's country_codes file."""
    codes = pd.read_csv(path, dtype=str)
    need = {"country_code", "country_iso3"}
    if not need <= set(codes.columns):
        raise ValueError(f"{path.name}: need columns {sorted(need)}, got {list(codes)}")
    mapping: dict[str, str] = {}
    for code, iso3 in zip(codes["country_code"], codes["country_iso3"], strict=True):
        if isinstance(iso3, str) and len(iso3.strip()) == 3:
            mapping[str(code).strip()] = iso3.strip().upper()
    return mapping


def normalize_chunk(
    chunk: pd.DataFrame,
    mapping: dict[str, str],
    *,
    value_scale: float,
    year_min: int,
    year_max: int | None,
    hs2: set[str] | None,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Map a BACI (t,i,j,k,v,q) chunk to the raw trade contract; count discards."""
    counts = {
        "n_in": len(chunk),
        "n_out_of_years": 0,
        "n_other_hs2": 0,
        "n_unmapped_country": 0,
        "n_null_value": 0,
    }
    out = pd.DataFrame(
        {
            "year": pd.to_numeric(chunk["t"], errors="coerce"),
            "exporter": chunk["i"].astype(str).str.strip().map(mapping),
            "importer": chunk["j"].astype(str).str.strip().map(mapping),
            "hs6": chunk["k"].astype(str).str.strip().str.zfill(6),
            "value_usd": pd.to_numeric(chunk["v"], errors="coerce") * value_scale,
        },
    )
    keep = out["year"].ge(year_min)
    if year_max is not None:
        keep &= out["year"].le(year_max)
    counts["n_out_of_years"] = int((~keep).sum())
    out = out[keep]
    if hs2 is not None:
        in_hs = out["hs6"].str[:2].isin(hs2)
        counts["n_other_hs2"] = int((~in_hs).sum())
        out = out[in_hs]
    mapped = out["exporter"].notna() & out["importer"].notna()
    counts["n_unmapped_country"] = int((~mapped).sum())
    out = out[mapped]
    has_value = out["value_usd"].notna()
    counts["n_null_value"] = int((~has_value).sum())
    out = out[has_value].copy()
    out["year"] = out["year"].astype(int)
    return out, counts


def _trade_members(base: Path) -> list[Path]:
    return sorted(p for p in base.rglob("*.csv") if p.name.upper().startswith("BACI_"))


def _chunks(path: Path) -> Iterator[pd.DataFrame]:
    yield from pd.read_csv(
        path,
        dtype={"t": str, "i": str, "j": str, "k": str},
        chunksize=CHUNK_ROWS,
    )


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Unzip the dropped BACI archive and normalise it to ``trade.csv``.

    The archive must be placed by a human in ``data/manual/baci/``; no URL is
    ever fetched. When ``config/pins/baci.json`` exists, size and sha256 are
    verified before anything is unpacked.
    """
    dest_dir = raw_source_dir("baci", version, root=root)
    dest = dest_dir / "trade.csv"
    if dest.is_file() and not force:
        return {
            "source": "baci",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    archive = find_drop("baci", root=root, suffix=".zip")
    pin = load_pin("baci", root=root)
    observed = verify_pin(archive, pin) if pin else None
    options = (pin.options if pin else None) or {}
    members = safe_extract(archive, dest_dir / "zip_members")
    base = dest_dir / "zip_members"
    country_files = sorted(base.rglob("country_codes*.csv"))
    if not country_files:
        raise FileNotFoundError("BACI zip has no country_codes*.csv member")
    mapping = country_code_map(country_files[0])
    trade_files = _trade_members(base)
    if not trade_files:
        raise FileNotFoundError("BACI zip has no BACI_*.csv trade member")
    hs2 = (
        {str(c).zfill(2) for c in options["hs_chapters"]}
        if options.get("hs_chapters")
        else None
    )
    scale = float(options.get("value_scale", DEFAULT_VALUE_SCALE))
    year_min = int(options.get("year_min", MIN_YEAR))
    year_max = int(options["year_max"]) if options.get("year_max") is not None else None

    totals: dict[str, int] = {}
    n_rows = 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("w", encoding="utf-8", newline="") as fh:
        header = True
        for trade_file in trade_files:
            for chunk in _chunks(trade_file):
                frame, counts = normalize_chunk(
                    chunk,
                    mapping,
                    value_scale=scale,
                    year_min=year_min,
                    year_max=year_max,
                    hs2=hs2,
                )
                for key, val in counts.items():
                    totals[key] = totals.get(key, 0) + val
                if frame.empty:
                    continue
                frame.to_csv(fh, index=False, header=header)
                header = False
                n_rows += len(frame)
    if n_rows == 0:
        raise ValueError("BACI normalisation produced no rows")
    meta = write_file_meta(
        dest,
        url=f"manual://baci/{archive.name}",
        extra_meta={
            "mode": "live",
            "input": "manual_zip",
            "version": version,
            "archive": archive.name,
            "archive_sha256": (observed or {}).get("sha256"),
            "archive_bytes": archive.stat().st_size,
            "pin_checked": bool(observed and observed["pin_checked"]),
            "pin_url": pin.url if pin else None,
            "value_scale": scale,
            "rows": n_rows,
            "discards": totals,
            "members": members,
        },
    )
    return {
        "source": "baci",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
        "rows": n_rows,
        "discards": totals,
    }


def live_version(*, root: Path | None = None) -> str:
    """Version string for the dropped archive (pin version or content hash)."""
    return manual_version(
        "baci", find_drop("baci", root=root, suffix=".zip"), root=root
    )
