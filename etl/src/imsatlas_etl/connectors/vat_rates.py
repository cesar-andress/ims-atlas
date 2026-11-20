"""Static VAT table (cited official rates; annual review)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from imsatlas_etl.connectors.http import write_artifact
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.io_paths import raw_source_dir

STATIC_REL = Path("data/static/vat_rates.csv")


def probe_version(*, root: Path | None = None) -> dict[str, Any]:
    path = (root or repo_root()) / STATIC_REL
    if not path.is_file():
        raise FileNotFoundError(path)
    # Version = latest reviewed_on in file header rows (parse lightly).
    text = path.read_text(encoding="utf-8")
    reviewed = "unknown"
    for line in text.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) >= 6 and parts[5].strip():
            reviewed = parts[5].strip()
    return {
        "upstream_version": f"vat-{reviewed}",
        "upstream_changed_at": reviewed,
        "note": "static cited VAT table under data/static/",
    }


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = (root or repo_root()) / STATIC_REL
    dest = raw_source_dir("vat_rates", version, root=root) / "indicators.csv"
    if dest.is_file() and not force:
        return {
            "source": "vat_rates",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    # Keep iso3,year,indicator,value for contracts; drop citation cols.
    import pandas as pd

    frame = pd.read_csv(src)
    slim = frame[["iso3", "year", "indicator", "value"]].copy()
    meta = write_artifact(
        dest,
        slim.to_csv(index=False).encode("utf-8"),
        url=f"file://{STATIC_REL.as_posix()}",
        headers={},
        extra_meta={"mode": "live", "version": version, "n_rows": int(len(slim))},
    )
    return {
        "source": "vat_rates",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
        "rows": int(len(slim)),
    }
