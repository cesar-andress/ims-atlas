"""Release guards: refuse empty country_product; partition large bilateral."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from imsatlas_etl.pipeline.promote import prune_old_releases
from imsatlas_etl.pipeline.release_tables import (
    MIN_COUNTRY_PRODUCT_CHAPTERS,
    write_bilateral_table,
    write_country_product_partitions,
)


def test_write_bilateral_partitions_when_over_budget(tmp_path: Path) -> None:
    rows = []
    for i in range(80_000):
        rows.append(
            {
                "iso3_o": "ESP",
                "iso3_d": f"C{i % 200:03d}",
                "year": 2020 + (i % 5),
                "variable_id": "DIST" if i % 2 == 0 else "LANG",
                "value": float(i),
                "flag_imputed": False,
                "flag_locf": False,
            },
        )
    frame = pd.DataFrame(rows)
    meta = write_bilateral_table(frame, tmp_path, max_file_bytes=400_000)
    assert meta["layout"] == "partitioned"
    assert meta["parts"] == 2
    assert not (tmp_path / "bilateral_year.parquet").exists()
    assert (tmp_path / "bilateral_year" / "index.json").is_file()
    assert all(
        (tmp_path / "bilateral_year" / rel).stat().st_size <= 400_000
        for rel in (
            "variable_id=DIST/part.parquet",
            "variable_id=LANG/part.parquet",
        )
    )


def test_prune_keeps_three_versions(tmp_path: Path) -> None:
    for ver in ("v1.0.0", "v1.1.0", "v1.2.0", "v1.3.0"):
        (tmp_path / ver).mkdir()
    (tmp_path / "CURRENT").write_text("v1.3.0\n", encoding="utf-8")
    removed = prune_old_releases(tmp_path, keep=3)
    assert removed == ["v1.0.0"]
    assert (tmp_path / "v1.1.0").is_dir()
    assert (tmp_path / "CURRENT").read_text(encoding="utf-8").strip() == "v1.3.0"


def test_country_product_refuses_empty_when_curated_full(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    curated = tmp_path / "curated"
    by_hs2 = curated / "country_product_by_hs2"
    by_hs2.mkdir(parents=True)
    for i in range(MIN_COUNTRY_PRODUCT_CHAPTERS):
        (by_hs2 / f"hs2={i:02d}").mkdir()
    (curated / "country_product.parquet").write_bytes(b"not-a-parquet")

    monkeypatch.setattr(
        "imsatlas_etl.pipeline.release_tables.curated_dir",
        lambda root=None: curated,  # noqa: ARG005
    )
    monkeypatch.setattr(
        "imsatlas_etl.pipeline.release_tables.source_shippable",
        lambda _sid: True,
    )
    with pytest.raises(ValueError, match="refuse empty release"):
        write_country_product_partitions(
            root=tmp_path,
            dest=tmp_path / "release",
            included_ids={"IMPV"},
        )
