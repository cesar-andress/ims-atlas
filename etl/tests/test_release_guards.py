"""Release guards: refuse empty country_product; partition large bilateral."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from imsatlas_etl.pipeline.promote import (
    assert_current_pointer_healthy,
    assert_current_update_allowed,
    prune_old_releases,
)
from imsatlas_etl.pipeline.release import assert_release_not_shrunk
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


def test_assert_release_not_shrunk_blocks_empty_vs_prior(tmp_path: Path) -> None:
    prev = tmp_path / "v1.1.0"
    (prev / "country_product" / "hs2=09").mkdir(parents=True)
    for i in range(MIN_COUNTRY_PRODUCT_CHAPTERS):
        (prev / "country_product" / f"hs2={i:02d}").mkdir(parents=True, exist_ok=True)
    (prev / "manifest.json").write_text(
        json.dumps({"row_counts": {"country_product_rows": 1_000_000}}) + "\n",
        encoding="utf-8",
    )
    dest = tmp_path / "v1.2.0"
    (dest / "country_product" / "hs2=_empty").mkdir(parents=True)
    with pytest.raises(ValueError, match="refuse shrink"):
        assert_release_not_shrunk(
            dest,
            {"country_product_rows": 0},
            previous=prev,
        )


def test_assert_release_not_shrunk_blocks_20pct_drop(tmp_path: Path) -> None:
    prev = tmp_path / "v1.1.0"
    prev.mkdir()
    (prev / "manifest.json").write_text(
        json.dumps({"row_counts": {"country_year_rows": 1000}}) + "\n",
        encoding="utf-8",
    )
    dest = tmp_path / "v1.2.0"
    dest.mkdir()
    for i in range(MIN_COUNTRY_PRODUCT_CHAPTERS):
        (dest / "country_product" / f"hs2={i:02d}").mkdir(parents=True)
    with pytest.raises(ValueError, match="country_year_rows shrank"):
        assert_release_not_shrunk(
            dest,
            {"country_product_rows": 100, "country_year_rows": 700},
            previous=prev,
        )


def _full_chapters(release: Path) -> None:
    for i in range(MIN_COUNTRY_PRODUCT_CHAPTERS):
        (release / "country_product" / f"hs2={i:02d}").mkdir(parents=True, exist_ok=True)


def test_current_pointer_rejects_empty_when_newer_full_exists(tmp_path: Path) -> None:
    empty = tmp_path / "v1.1.0"
    (empty / "country_product" / "hs2=_empty").mkdir(parents=True)
    good = tmp_path / "v1.2.0"
    _full_chapters(good)
    (tmp_path / "CURRENT").write_text("v1.1.0\n", encoding="utf-8")
    with pytest.raises(ValueError, match="refuse empty/old pointer"):
        assert_current_pointer_healthy(tmp_path)


def test_current_update_refuses_demotion_to_older(tmp_path: Path) -> None:
    older = tmp_path / "v1.1.0"
    _full_chapters(older)
    newer = tmp_path / "v1.2.0"
    _full_chapters(newer)
    (tmp_path / "CURRENT").write_text("v1.2.0\n", encoding="utf-8")
    with pytest.raises(ValueError, match="refuse CURRENT demotion"):
        assert_current_update_allowed(tmp_path, "1.1.0")
    assert_current_update_allowed(tmp_path, "1.1.0", allow_pointer_demote=True)


def test_current_pointer_ok_when_pointing_at_full(tmp_path: Path) -> None:
    older = tmp_path / "v1.1.0"
    (older / "country_product" / "hs2=_empty").mkdir(parents=True)
    newer = tmp_path / "v1.2.0"
    _full_chapters(newer)
    (tmp_path / "CURRENT").write_text("v1.2.0\n", encoding="utf-8")
    assert assert_current_pointer_healthy(tmp_path) == "v1.2.0"


def test_current_pointer_rejects_stale_when_newer_full_exists(tmp_path: Path) -> None:
    older = tmp_path / "v1.1.0"
    _full_chapters(older)
    newer = tmp_path / "v1.2.0"
    _full_chapters(newer)
    (tmp_path / "CURRENT").write_text("v1.1.0\n", encoding="utf-8")
    with pytest.raises(ValueError, match="refuse stale pointer"):
        assert_current_pointer_healthy(tmp_path)
