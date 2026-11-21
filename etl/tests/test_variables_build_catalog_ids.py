"""Catalog ids (not WB codes) must be the columns of variables_country_year."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from imsatlas_etl.pipeline.variables_build import WB_CODE_TO_VAR, WGI_PARTS


def test_wb_map_uses_catalog_ids() -> None:
    ids = {vid for vid, _sid in WB_CODE_TO_VAR.values()}
    assert "LPI" in ids
    assert "INFL" in ids
    assert "GDPPC" in ids
    assert "CC" in ids
    assert "LP.LPI.OVRL.XQ" not in ids
    assert set(WGI_PARTS).issubset(ids)
    assert "ecb_fx" not in {sid for _vid, sid in WB_CODE_TO_VAR.values()}


def test_fixture_meta_shape(tmp_path: Path) -> None:
    # Smoke: wide frame with catalog ids melts cleanly for stores/release.
    wide = pd.DataFrame(
        {
            "iso3": ["ESP", "COL"],
            "year": [2023, 2023],
            "LPI": [3.5, 2.9],
            "CC": [0.8, -0.2],
        },
    )
    long = wide.melt(
        id_vars=["iso3", "year"],
        value_vars=["LPI", "CC"],
        var_name="variable_id",
        value_name="value",
    )
    assert set(long["variable_id"]) == {"LPI", "CC"}
    assert len(long) == 4
    path = tmp_path / "variables_country_year.parquet"
    wide.to_parquet(path, index=False)
    assert path.is_file()
