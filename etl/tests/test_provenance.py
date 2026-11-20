from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq
import pytest

from imsatlas_etl.pipeline.provenance import (
    BILATERAL_TABLE,
    COUNTRY_TABLE,
    PROVENANCE_COLUMNS,
    PROVENANCE_SCHEMA,
    ProvenanceError,
    VariableOrigin,
    build_provenance_for_release,
    build_provenance_frame,
    empty_provenance,
    iso3_remap_pairs,
    make_row_keys,
    provenance_join_problems,
    write_provenance_parquet,
)
from imsatlas_etl.pipeline.release import run_release
from imsatlas_etl.pipeline.release_tables import write_spec3_tables


def _origin(vid: str, *, code: str | None = "X") -> VariableOrigin:
    return VariableOrigin(
        variable_id=vid,
        source_id="src",
        upstream_code=code,
        upstream_version="v1",
        request_url_or_file="file://raw.csv",
        raw_sha256="0" * 64,
        transform_steps=("load", "melt"),
    )


def _cells() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "iso3": ["AAA", "BBB"],
            "year": [2020, 2021],
            "variable_id": ["V1", "V1"],
            "value": [1.5, 2.5],
            "flag_imputed": [False, False],
            "flag_locf": [False, True],
        },
    )


def test_row_keys_include_code_only_when_present() -> None:
    keys = make_row_keys(_cells(), COUNTRY_TABLE, {"V1": "CODE"})
    assert list(keys) == ["AAA|2020|CODE", "BBB|2021|CODE"]
    bare = make_row_keys(_cells(), COUNTRY_TABLE, {"V1": None})
    assert list(bare) == ["AAA|2020", "BBB|2021"]


def test_build_frame_one_row_per_cell_and_flags() -> None:
    frame = build_provenance_frame(
        _cells(),
        COUNTRY_TABLE,
        {"V1": _origin("V1")},
        remapped={"V1": {("BBB", 2021)}},
    )
    assert list(frame.columns) == PROVENANCE_COLUMNS
    assert len(frame) == 2
    assert frame["flag_locf"].tolist() == [False, True]
    assert frame["flag_iso3_remap"].tolist() == [False, True]
    assert frame["flag_unit_converted"].tolist() == [False, False]
    assert frame["value"].tolist() == [1.5, 2.5]
    assert frame["iso3_o"].isna().all()
    assert frame["transform_steps"].iloc[0] == ["load", "melt"]


def test_build_frame_bilateral_columns() -> None:
    cells = pd.DataFrame(
        {
            "iso3_o": ["AAA"],
            "iso3_d": ["BBB"],
            "year": [2020],
            "variable_id": ["V1"],
            "value": [3.0],
            "flag_imputed": [False],
            "flag_locf": [False],
        },
    )
    frame = build_provenance_frame(cells, BILATERAL_TABLE, {"V1": _origin("V1")})
    assert frame["iso3"].isna().all()
    assert frame["row_key"].tolist() == ["AAA|BBB|2020|X"]


def test_unknown_variable_raises_not_dropped() -> None:
    with pytest.raises(ProvenanceError, match="no provenance origin"):
        build_provenance_frame(_cells(), COUNTRY_TABLE, {})


def test_duplicate_cells_raise() -> None:
    dup = pd.concat([_cells(), _cells()], ignore_index=True)
    with pytest.raises(ProvenanceError, match="duplicate"):
        build_provenance_frame(dup, COUNTRY_TABLE, {"V1": _origin("V1")})


def test_empty_cells_give_empty_frame() -> None:
    empty = build_provenance_frame(_cells().iloc[0:0], COUNTRY_TABLE, {})
    assert empty.empty
    assert list(empty.columns) == PROVENANCE_COLUMNS


def test_join_problems_detect_missing_and_orphans() -> None:
    cells = _cells()
    prov = build_provenance_frame(cells, COUNTRY_TABLE, {"V1": _origin("V1")})
    assert provenance_join_problems({COUNTRY_TABLE: cells}, prov) == []
    missing = provenance_join_problems({COUNTRY_TABLE: cells}, prov.iloc[:1])
    assert missing == [f"{COUNTRY_TABLE}: 1 cells without provenance"]
    orphan = provenance_join_problems({COUNTRY_TABLE: cells.iloc[:1]}, prov)
    assert orphan == [f"{COUNTRY_TABLE}: 1 orphan provenance rows"]
    doubled = pd.concat([prov, prov], ignore_index=True)
    assert any(
        "duplicate" in p
        for p in provenance_join_problems({COUNTRY_TABLE: cells}, doubled)
    )


def test_join_problems_on_empty_provenance() -> None:
    cells = _cells()
    problems = provenance_join_problems({COUNTRY_TABLE: cells}, empty_provenance())
    assert problems == [f"{COUNTRY_TABLE}: 2 cells without provenance"]


def test_iso3_remap_pairs_only_for_name_mapped_rows() -> None:
    raw = pd.DataFrame(
        {
            "country_name": ["Spain", "Mexico", "Atlantis"],
            "iso3": [None, "MEX", None],
            "year": [2020, 2020, 2020],
            "value": [1.0, 2.0, 3.0],
        },
    )
    assert iso3_remap_pairs(raw) == {("ESP", 2020)}
    assert iso3_remap_pairs(raw.drop(columns=["country_name"])) == set()


def test_parquet_schema_is_fixed_even_when_empty(tmp_path: Path) -> None:
    path = tmp_path / "provenance.parquet"
    write_provenance_parquet(empty_provenance(), path)
    table = pq.read_table(path)
    assert table.num_rows == 0
    assert table.schema.equals(PROVENANCE_SCHEMA, check_metadata=False)


def test_empty_release_writes_empty_provenance(
    world_root: Path, no_ship_gate: None
) -> None:
    result = run_release("0.1.0", root=world_root, staging=True, force=True)
    release = Path(result["path"])
    assert result["n_included_variables"] == 0
    assert len(pd.read_parquet(release / "provenance.parquet")) == 0
    assert not (release / "provenance.jsonl").exists()
    files = {f["path"]: f for f in result["manifest"]["files"]}
    assert files["provenance.parquet"]["rows"] == 0
    assert len(files["provenance.parquet"]["sha256"]) == 64
    assert result["manifest"]["row_counts"]["provenance_rows"] == 0


def _staging_with_cells(world_root: Path, tmp_path: Path) -> Path:
    dest = tmp_path / "release"
    dest.mkdir()
    ids = {"CO2PC", "PLI", "ITU_IDI", "DIST", "LANG", "FTA", "TARIF"}
    counts = write_spec3_tables(dest, root=world_root, included_ids=ids)
    assert counts["country_year_rows"] > 0 and counts["bilateral_year_rows"] > 0
    return dest


def test_fixture_world_every_cell_has_exactly_one_provenance_row(
    world_root: Path,
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    dest = _staging_with_cells(world_root, tmp_path_factory.mktemp("rel"))
    summary = build_provenance_for_release(dest, root=world_root)
    country = pd.read_parquet(dest / "country_year.parquet")
    bilateral = pd.read_parquet(dest / "bilateral_year.parquet")
    prov = pd.read_parquet(dest / "provenance.parquet")
    assert summary["provenance_rows"] == len(country) + len(bilateral) > 0
    assert (
        provenance_join_problems(
            {COUNTRY_TABLE: country, BILATERAL_TABLE: bilateral},
            prov,
        )
        == []
    )
    c = prov[prov["table"] == COUNTRY_TABLE]
    merged = country.merge(c, on=["iso3", "year", "variable_id"], suffixes=("", "_p"))
    assert len(merged) == len(country)
    assert (merged["value"] == merged["value_p"]).all()
    assert (prov["raw_sha256"].str.len() == 64).all()
    assert not prov.duplicated(["variable_id", "row_key"]).any()


def test_fixture_world_provenance_content(
    world_root: Path,
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    dest = _staging_with_cells(world_root, tmp_path_factory.mktemp("rel"))
    build_provenance_for_release(dest, root=world_root)
    prov = pd.read_parquet(dest / "provenance.parquet")
    co2 = prov[(prov["variable_id"] == "CO2PC") & (prov["iso3"] == "ESP")]
    assert set(co2["source_id"]) == {"worldbank_wdi"}
    assert set(co2["upstream_code"]) == {"EN.GHG.CO2.PC.CE.AR5"}
    assert set(co2["upstream_version"]) == {"mini-2022"}
    assert set(co2["request_url_or_file"]) == {
        "fixture://worldbank_wdi/indicators.csv",
    }
    assert "ESP|2022|EN.GHG.CO2.PC.CE.AR5" in set(co2["row_key"])
    # Spain in the ITU fixture has no iso3 column value: remapped by name.
    itu = prov[prov["variable_id"] == "ITU_IDI"]
    assert itu[itu["iso3"] == "ESP"]["flag_iso3_remap"].all()
    assert not itu[itu["iso3"] == "MEX"]["flag_iso3_remap"].any()
    tarif = prov[prov["variable_id"] == "TARIF"]
    assert "mean_ahs_over_hs6" in tarif["transform_steps"].iloc[0]
    assert tarif["iso3"].isna().all() and tarif["iso3_o"].notna().all()
    assert not prov["flag_imputed"].any() and not prov["flag_locf"].any()
    lines = (dest / "provenance.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(lines) == len(prov) == min(len(prov), 200)
    assert json.loads(lines[0])["transform_steps"]


def test_provenance_requires_raw_artefact(
    world_root: Path,
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    dest = _staging_with_cells(world_root, tmp_path_factory.mktemp("rel"))
    (world_root / "data/raw/worldbank_wdi/mini-2022/indicators.csv").unlink()
    with pytest.raises(ProvenanceError, match="raw artefact missing"):
        build_provenance_for_release(dest, root=world_root)
