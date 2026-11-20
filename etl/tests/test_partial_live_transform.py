"""Live-mode transform with only World Bank raw (recorded responses, no network)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd

from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.io_paths import curated_dir
from imsatlas_etl.pipeline.runner import run_pipeline

# Recorded ISO3 universe from a live WDI extract (no network in tests).
_ISO3 = (
    (Path(__file__).parent / "fixtures" / "wb_iso3.txt")
    .read_text(encoding="utf-8")
    .split()
)


def _plant_wb(
    root: Path,
    source_id: str,
    version: str,
    codes: list[str],
    *,
    years: tuple[int, ...] = (1990, 2000, 2010, 2020, 2022, 2025),
) -> None:
    rows: list[dict[str, object]] = []
    for iso3 in _ISO3:
        for year in years:
            for code in codes:
                rows.append(
                    {
                        "iso3": iso3,
                        "year": year,
                        "indicator": code,
                        "value": float((hash((iso3, year, code)) % 10_000) / 100.0),
                    },
                )
    base = root / "data" / "raw" / source_id / version
    base.mkdir(parents=True, exist_ok=True)
    path = base / "indicators.csv"
    pd.DataFrame(rows).to_csv(path, index=False)
    meta = {
        "mode": "live",
        "source": source_id,
        "version": version,
        "rows": len(rows),
    }
    path.with_suffix(path.suffix + ".meta.json").write_text(
        json.dumps(meta, indent=2) + "\n",
        encoding="utf-8",
    )


def test_live_wb_only_transform_fills_country_year(tmp_path: Path) -> None:
    for name in ("catalog", "config"):
        shutil.copytree(repo_root() / name, tmp_path / name)

    version = "2026-11-11"
    _plant_wb(
        tmp_path,
        "worldbank_wdi",
        version,
        ["NY.GDP.PCAP.PP.KD", "SP.POP.TOTL", "EN.GHG.CO2.PC.CE.AR5", "PA.NUS.PRVT.PLI"],
    )
    _plant_wb(tmp_path, "worldbank_wgi", version, ["CC.EST", "GE.EST", "RQ.EST"])
    _plant_wb(tmp_path, "worldbank_lpi", version, ["LP.LPI.OVRL.XQ"])

    freshness = {
        "generated_at": "2026-11-20T00:00:00Z",
        "mode": "live",
        "is_fixture": False,
        "sources": [
            {
                "source": sid,
                "mode": "live",
                "upstream_version": version,
                "ingested_version": version,
                "stale": False,
                "checked_at": "2026-11-20T00:00:00Z",
            }
            for sid in ("worldbank_wdi", "worldbank_wgi", "worldbank_lpi")
        ],
    }
    (tmp_path / "status").mkdir(parents=True, exist_ok=True)
    (tmp_path / "status" / "freshness.json").write_text(
        json.dumps(freshness, indent=2) + "\n",
        encoding="utf-8",
    )

    log = run_pipeline(
        steps=["transform", "qa", "lineage", "stores"],
        sources=["worldbank_wdi", "worldbank_wgi", "worldbank_lpi"],
        root=tmp_path,
        force=True,
        access_mode="CERRADO",
    )
    assert log["status"] in {"ok", "qa_blocked"}
    assert log["steps"]["transform"]["status"] == "ok"
    missing_ids = {m["id"] for m in log.get("missing_sources", [])}
    assert "baci" in missing_ids
    assert "cepi_gravity" in missing_ids
    assert "hofstede" in missing_ids

    country = pd.read_parquet(curated_dir(root=tmp_path) / "country_year.parquet")
    assert country["iso3"].nunique() > 200
    assert int(country["year"].min()) <= 1990
    assert int(country["year"].max()) >= 2025
    assert "NY.GDP.PCAP.PP.KD" in country.columns
    assert "CC.EST" in country.columns
    assert "LP.LPI.OVRL.XQ" in country.columns

    variables = pd.read_parquet(
        curated_dir(root=tmp_path) / "variables_country_year.parquet",
    )
    assert variables["iso3"].nunique() > 200
    assert "CO2PC" in variables.columns
    assert "PLI" in variables.columns
