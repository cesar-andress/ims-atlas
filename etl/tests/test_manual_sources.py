"""BACI / Gravity zip drops and manual-drop CSV sources (no network)."""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

import pytest

from imsatlas_etl.connectors import baci, gravity, manual_drop
from imsatlas_etl.connectors.http import SourceUnavailableError
from imsatlas_etl.connectors.manual import (
    PinMismatchError,
    find_drop,
    load_pin,
    manual_version,
    safe_extract,
)
from imsatlas_etl.contracts.schemas import (
    bilateral_schema,
    index_values_schema,
    trade_schema,
)
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.extract import extract_source
from imsatlas_etl.pipeline.io_paths import PHASE3_INDEX_SOURCES
from imsatlas_etl.sources import sources_by_id

FIXTURES = Path(__file__).parent / "fixtures" / "mini_world"

BACI_CSV = (
    "t,i,j,k,v,q\n"
    "2020,170,724,640399,100.5,10\n"
    "2020,170,724,85000,7,1\n"  # 5-digit code in file -> zero padded
    "2020,170,999,640399,5,1\n"  # unmapped importer
    "2020,170,724,640399,,1\n"  # null value
    "1985,170,724,640399,9,1\n"  # before 1990
)
COUNTRY_CSV = (
    "country_code,country_name,country_iso2,country_iso3\n"
    "170,Colombia,CO,COL\n"
    "724,Spain,ES,ESP\n"
    "999,Residual,XX,\n"
)
GRAVITY_CSV = (
    "year,iso3_o,iso3_d,distw_harmonic,comlang_off,fta_wto,extra\n"
    "2020,COL,ESP,8000.5,1,0,a\n"
    "2020,COL,ESP,,1,0,dup_less_complete\n"
    "2020,ESP,COL,8000.5,1,,x\n"  # missing fta -> incomplete
    "1980,ESP,COL,8000.5,1,0,old\n"
    "2020,COL,COL,0,1,1,self\n"  # origin=destination, distw=0 → dropped
)


def _zip(path: Path, members: dict[str, str]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as zf:
        for name, text in members.items():
            zf.writestr(name, text)
    return path


def _pin(root: Path, source: str, **fields: object) -> None:
    path = root / "config" / "pins" / f"{source}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fields), encoding="utf-8")


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --- BACI ------------------------------------------------------------------


def test_baci_live_extract_normalises_and_counts(tmp_path: Path) -> None:
    archive = _zip(
        tmp_path / "data/manual/baci/BACI_HS92_V1.zip",
        {
            "country_codes_V1.csv": COUNTRY_CSV,
            "BACI_HS92_Y2020_V1.csv": BACI_CSV,
            "Readme.txt": "ignored",
        },
    )
    _pin(
        tmp_path,
        "baci",
        version="HS92-V1",
        sha256=_sha(archive),
        bytes=archive.stat().st_size,
        url=None,
    )
    version = baci.live_version(root=tmp_path)
    assert version == "HS92-V1"
    res = baci.extract_live(version, root=tmp_path)
    assert res["rows"] == 2
    frame = baci.load_raw_trade(Path(res["path"]))
    trade_schema.validate(frame)
    first = frame[frame["hs6"] == "640399"].iloc[0]
    assert first["exporter"] == "COL" and first["importer"] == "ESP"
    assert first["value_usd"] == pytest.approx(100500.0)  # v * 1000
    assert "085000" in set(frame["hs6"])
    d = res["discards"]
    assert d["n_unmapped_country"] == 1
    assert d["n_null_value"] == 1
    assert d["n_out_of_years"] == 1
    meta = json.loads(Path(res["path"] + ".meta.json").read_text())
    assert meta["pin_checked"] is True
    assert meta["pin_url"] is None
    assert meta["value_scale"] == 1000.0
    unzipped = tmp_path / "data/raw/baci/HS92-V1/zip_members"
    assert (unzipped / "BACI_HS92_Y2020_V1.csv").is_file()


def test_baci_pin_mismatch_blocks_extract(tmp_path: Path) -> None:
    _zip(
        tmp_path / "data/manual/baci/b.zip",
        {"country_codes.csv": COUNTRY_CSV, "BACI_X.csv": BACI_CSV},
    )
    _pin(tmp_path, "baci", version="v", sha256="0" * 64, bytes=None, url=None)
    with pytest.raises(PinMismatchError, match="sha256"):
        baci.extract_live("v", root=tmp_path)
    assert not (tmp_path / "data/raw/baci/v/trade.csv").exists()


def test_baci_pin_size_mismatch(tmp_path: Path) -> None:
    _zip(tmp_path / "data/manual/baci/b.zip", {"country_codes.csv": COUNTRY_CSV})
    _pin(tmp_path, "baci", version="v", sha256=None, bytes=1, url=None)
    with pytest.raises(PinMismatchError, match="size"):
        baci.extract_live("v", root=tmp_path)


def test_baci_without_pin_uses_content_hash_version(tmp_path: Path) -> None:
    archive = _zip(
        tmp_path / "data/manual/baci/b.zip",
        {"country_codes.csv": COUNTRY_CSV, "BACI_X.csv": BACI_CSV},
    )
    assert baci.live_version(root=tmp_path) == f"manual-{_sha(archive)[:12]}"


def test_baci_missing_drop_is_source_unavailable(tmp_path: Path) -> None:
    with pytest.raises(SourceUnavailableError, match="README"):
        baci.extract_live("v", root=tmp_path)
    (tmp_path / "data/manual/baci").mkdir(parents=True)
    with pytest.raises(SourceUnavailableError, match="no .zip"):
        baci.extract_live("v", root=tmp_path)


def test_baci_options_filter_chapters(tmp_path: Path) -> None:
    _zip(
        tmp_path / "data/manual/baci/b.zip",
        {"country_codes.csv": COUNTRY_CSV, "BACI_X.csv": BACI_CSV},
    )
    _pin(
        tmp_path,
        "baci",
        version="v",
        sha256=None,
        bytes=None,
        url=None,
        options={"hs_chapters": ["64"], "value_scale": 1},
    )
    res = baci.extract_live("v", root=tmp_path)
    frame = baci.load_raw_trade(Path(res["path"]))
    assert set(frame["hs6"]) == {"640399"}
    assert frame["value_usd"].iloc[0] == pytest.approx(100.5)
    assert res["discards"]["n_other_hs2"] == 1


# --- Gravity ---------------------------------------------------------------


def test_gravity_live_extract_dedupes_and_counts(tmp_path: Path) -> None:
    _zip(
        tmp_path / "data/manual/cepi_gravity/Gravity_csv.zip",
        {"Gravity_V1.csv": GRAVITY_CSV, "small.csv": "a\n1\n"},
    )
    _pin(tmp_path, "cepi_gravity", version="V1", sha256=None, bytes=None, url=None)
    res = gravity.extract_live("V1", root=tmp_path)
    frame = gravity.load_raw_bilateral(Path(res["path"]))
    bilateral_schema.validate(frame)
    assert len(frame) == 1
    row = frame.iloc[0]
    assert (row["origin"], row["destination"], row["year"]) == ("COL", "ESP", 2020)
    assert row["distw"] == pytest.approx(8000.5)
    assert res["discards"] == {
        "n_in": 5,
        "n_out_of_years": 1,
        "n_self_pairs": 1,
        "n_duplicate_keys": 1,
        "n_incomplete": 1,
    }
    meta = json.loads(Path(res["path"] + ".meta.json").read_text())
    assert meta["column_map"]["distw"] == "distw_harmonic"
    assert meta["source_csv"] == "Gravity_V1.csv"


def test_gravity_self_pair_distw_zero_is_dropped(tmp_path: Path) -> None:
    """Origin=destination rows with distw=0 must not fail the bilateral contract."""
    csv = (
        "year,iso3_o,iso3_d,distw,comlang_off,fta_wto\n"
        "2020,ESP,ESP,0,1,0\n"
        "2020,ESP,FRA,1050.0,0,1\n"
    )
    _zip(tmp_path / "data/manual/cepi_gravity/g.zip", {"g.csv": csv})
    _pin(tmp_path, "cepi_gravity", version="V1", sha256=None, bytes=None, url=None)
    res = gravity.extract_live("V1", root=tmp_path)
    frame = gravity.load_raw_bilateral(Path(res["path"]))
    bilateral_schema.validate(frame)
    assert len(frame) == 1
    assert tuple(frame.iloc[0][["origin", "destination", "distw"]]) == (
        "ESP",
        "FRA",
        1050.0,
    )
    assert res["discards"]["n_self_pairs"] == 1


def test_gravity_missing_columns_listed(tmp_path: Path) -> None:
    _zip(
        tmp_path / "data/manual/cepi_gravity/g.zip",
        {"g.csv": "year,iso3_o\n2020,COL\n"},
    )
    with pytest.raises(ValueError, match="missing"):
        gravity.extract_live("v", root=tmp_path)


def test_gravity_pin_url_may_be_null_and_is_never_invented(tmp_path: Path) -> None:
    _pin(tmp_path, "cepi_gravity", version="V1", sha256=None, bytes=None, url=None)
    pin = load_pin("cepi_gravity", root=tmp_path)
    assert pin is not None and pin.url is None
    assert load_pin("baci", root=tmp_path) is None


def test_unknown_pin_field_rejected(tmp_path: Path) -> None:
    _pin(tmp_path, "baci", version="v", mirror="https://invented.invalid")
    with pytest.raises(ValueError, match="unknown pin fields"):
        load_pin("baci", root=tmp_path)


def test_safe_extract_rejects_path_traversal(tmp_path: Path) -> None:
    evil = _zip(tmp_path / "evil.zip", {"../escape.txt": "x"})
    with pytest.raises(ValueError, match="unsafe zip member"):
        safe_extract(evil, tmp_path / "out")
    assert not (tmp_path / "escape.txt").exists()


def test_find_drop_ambiguous_requires_pin_filename(tmp_path: Path) -> None:
    for name in ("a.zip", "b.zip"):
        _zip(tmp_path / "data/manual/baci" / name, {"x.csv": "a\n"})
    with pytest.raises(SourceUnavailableError, match="several"):
        find_drop("baci", root=tmp_path, suffix=".zip")
    _pin(tmp_path, "baci", version="v", filename="b.zip")
    assert find_drop("baci", root=tmp_path, suffix=".zip").name == "b.zip"


# --- Manual CSV drops ------------------------------------------------------


def test_hofstede_manual_drop_copies_and_hashes(tmp_path: Path) -> None:
    src = FIXTURES / "hofstede" / "dimensions.csv"
    drop = tmp_path / "data/manual/hofstede/dimensions.csv"
    drop.parent.mkdir(parents=True)
    drop.write_bytes(src.read_bytes())
    version = manual_drop.live_version("hofstede", root=tmp_path)
    assert version == manual_version("hofstede", drop, root=tmp_path)
    res = manual_drop.extract_live("hofstede", version, root=tmp_path)
    out = Path(res["path"])
    assert out.read_bytes() == src.read_bytes()
    meta = json.loads(Path(res["path"] + ".meta.json").read_text())
    assert meta["sha256"] == _sha(src)
    assert meta["mode"] == "live" and meta["url"].startswith("manual://")


@pytest.mark.parametrize("source_id", sorted(PHASE3_INDEX_SOURCES))
def test_index_sources_manual_drop_roundtrip(tmp_path: Path, source_id: str) -> None:
    src = FIXTURES / source_id / "values.csv"
    drop = tmp_path / "data/manual" / source_id / "values.csv"
    drop.parent.mkdir(parents=True)
    drop.write_bytes(src.read_bytes())
    version = manual_drop.live_version(source_id, root=tmp_path)
    res = extract_source(
        source_id,
        version,
        fixture_root=None,
        root=tmp_path,
    )
    from imsatlas_etl.connectors.country_index import load_raw_values

    frame, unmatched = load_raw_values(Path(res["path"]))
    assert unmatched == []
    index_values_schema.validate(frame)


def test_manual_drop_missing_file_is_unavailable(tmp_path: Path) -> None:
    with pytest.raises(SourceUnavailableError, match="manual drop"):
        manual_drop.live_version("ef_epi", root=tmp_path)
    (tmp_path / "data/manual/ef_epi").mkdir(parents=True)
    with pytest.raises(SourceUnavailableError, match="values.csv"):
        manual_drop.live_version("ef_epi", root=tmp_path)


def test_fixture_mode_still_wins_when_fixture_root_given(tmp_path: Path) -> None:
    res = extract_source(
        "hofstede",
        "mini-2022",
        fixture_root=FIXTURES,
        root=tmp_path,
    )
    meta = json.loads(Path(res["path"] + ".meta.json").read_text())
    assert meta["mode"] == "fixture"


def test_live_extract_unknown_source_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unsupported"):
        extract_source("nope", "v", fixture_root=None, root=tmp_path)


# --- READMEs ---------------------------------------------------------------

MANUAL_README_SOURCES = [
    "baci",
    "cepi_gravity",
    "hofstede",
    "wits_trains",
    "worldbank_doing_business",
    "unctadstat",
    "imf_weo",
    *sorted(PHASE3_INDEX_SOURCES),
]


@pytest.mark.parametrize("source_id", MANUAL_README_SOURCES)
def test_manual_readme_exists_and_cites_registry_landing_url(source_id: str) -> None:
    readme = repo_root() / "data" / "manual" / source_id / "README.md"
    assert readme.is_file(), readme
    text = readme.read_text(encoding="utf-8")
    assert str(sources_by_id()[source_id]["landing_url"]) in text
    assert "gitignored" in text
    assert "not human-verified" in text


def test_manual_readmes_are_the_only_tracked_files_by_ignore_rules() -> None:
    ignore = (repo_root() / ".gitignore").read_text(encoding="utf-8")
    assert "data/manual/*/*" in ignore
    assert "!data/manual/*/README.md" in ignore


def test_readmes_never_contain_invented_cepii_download_urls() -> None:
    for source_id in ("baci", "cepi_gravity"):
        text = (repo_root() / "data/manual" / source_id / "README.md").read_text()
        assert "DATA_DOWNLOAD" not in text
        assert "http" not in text.replace(
            str(sources_by_id()[source_id]["landing_url"]),
            "",
        )
