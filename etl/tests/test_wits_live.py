"""WITS TRN SDMX loop against recorded-shape XML (no network)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd
import pytest

from imsatlas_etl.connectors import wits
from imsatlas_etl.connectors.http import HttpResponse, SourceUnavailableError
from imsatlas_etl.contracts.schemas import tariffs_schema
from imsatlas_etl.paths import repo_root

FIX = Path(__file__).parent / "fixtures" / "wits_live"


class FakeWits:
    """Serve fixture XML by file name; absent file means HTTP 404 (no data)."""

    def __init__(self) -> None:
        self.urls: list[str] = []

    def __call__(self, url: str) -> HttpResponse:
        self.urls.append(url)
        tail = url.rstrip("/").split("/")
        rep = tail[tail.index("reporter") + 1]
        ptn = tail[tail.index("partner") + 1]
        year = tail[tail.index("year") + 1]
        dtype = tail[tail.index("datatype") + 1]
        path = FIX / f"trn_r{rep}_p{ptn}_y{year}_{dtype}.xml"
        if path.is_file():
            return HttpResponse(200, path.read_bytes(), {})
        return HttpResponse(404, b"", {})


def _root(tmp_path: Path) -> Path:
    (tmp_path / "config").mkdir(parents=True)
    shutil.copy(
        repo_root() / "config" / "iso3_numeric.yaml",
        tmp_path / "config" / "iso3_numeric.yaml",
    )
    return tmp_path


def _cfg() -> wits.WitsConfig:
    return wits.WitsConfig(
        version="test-pull",
        reporters=("ESP", "FRA", "GBR"),
        partners=("COL",),
        year_start=2019,
        year_end=2021,
        hs_chapters=("64",),
    )


def test_reporter_codes_eu_and_gbr_rule() -> None:
    numeric = {"COL": "170", "GBR": "826", "USA": "840"}
    assert wits.reporter_code("ESP", 2019, numeric) == "918"
    assert wits.reporter_code("GBR", 2020, numeric) == "918"
    assert wits.reporter_code("GBR", 2021, numeric) == "826"
    assert wits.reporter_code("USA", 2020, numeric) == "840"
    with pytest.raises(KeyError):
        wits.reporter_code("ZZZ", 2020, numeric)


def test_destinations_expand_eu_reporter_per_year() -> None:
    numeric = {"GBR": "826"}
    reporters = ("ESP", "FRA", "GBR")
    assert wits.destinations_for("918", 2020, reporters, numeric) == [
        "ESP",
        "FRA",
        "GBR",
    ]
    assert wits.destinations_for("918", 2021, reporters, numeric) == ["ESP", "FRA"]
    assert wits.destinations_for("826", 2021, reporters, numeric) == ["GBR"]


def test_trn_url_pattern() -> None:
    assert wits.trn_url("918", "170", 2019, "aveestimated") == (
        "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/918/"
        "partner/170/product/all/year/2019/datatype/aveestimated"
    )


def test_parse_trn_xml_and_hs6_filter() -> None:
    lines = wits.parse_trn_xml(
        (FIX / "trn_r918_p170_y2019_reported.xml").read_bytes(),
    )
    assert len(lines) == 5
    kept, n_non_hs6 = wits.filter_hs6(lines, ("64",))
    assert sorted(kept["product_code"]) == ["640399", "640419", "640510"]
    assert n_non_hs6 == 1  # the 4-digit "6403" line is counted, not dropped silently
    assert wits.parse_trn_xml(b"").empty


def test_merge_prefers_aveestimated_only_for_na_lines() -> None:
    reported = pd.DataFrame(
        {
            "product_code": ["640399", "640510", "640520"],
            "year": [2019] * 3,
            "ahs": [5.0, 8.0, 1.0],
            "nbr_na_lines": [0, 1, 2],
        },
    )
    ave = pd.DataFrame(
        {
            "product_code": ["640399", "640510"],
            "year": [2019, 2019],
            "ahs": [99.0, 9.5],
            "nbr_na_lines": [0, 0],
        },
    )
    merged, missing = wits.merge_reported_aveestimated(reported, ave)
    by = merged.set_index("product_code")
    assert by.loc["640399", "ahs"] == 5.0  # no NA lines: reported kept
    assert by.loc["640510", "ahs"] == 9.5
    assert by.loc["640510", "ahs_source"] == "aveestimated"
    assert by.loc["640520", "ahs_source"] == "reported"
    assert missing == 1  # NA lines without an aveestimated value are flagged


def test_extract_live_full_loop(tmp_path: Path) -> None:
    root = _root(tmp_path)
    api = FakeWits()
    res = wits.extract_live(
        "test-pull",
        root=root,
        config=_cfg(),
        fetch=api,
        sleep=lambda _s: None,
    )
    assert res["rows"] == 10
    base = root / "data/raw/wits_trains/test-pull"
    table = wits.load_raw_tariffs(base / "tariffs.csv")
    tariffs_schema.validate(table)

    def ahs(year: int, dest: str, hs6: str) -> float:
        sel = table[
            (table["year"] == year)
            & (table["destination"] == dest)
            & (table["hs6"] == hs6)
        ]
        assert len(sel) == 1
        return float(sel["ahs"].iloc[0])

    # EU reporter 918 expands to members; GBR rides on 918 up to 2020.
    assert ahs(2019, "ESP", "640399") == 5.0
    assert ahs(2019, "GBR", "640399") == 5.0
    assert ahs(2019, "FRA", "640510") == 9.5  # aveestimated for NA line
    assert ahs(2020, "GBR", "640399") == 4.0
    # From 2021 GBR has its own reporter code (826).
    assert ahs(2021, "GBR", "640399") == 3.0
    assert set(table[table["year"] == 2021]["destination"]) == {"GBR"}
    assert set(table["origin"]) == {"COL"}

    # URL discipline: EU reporter, no MFN (partner 000) fallback anywhere.
    assert any("/reporter/918/partner/170/" in u for u in api.urls)
    assert any("/reporter/826/partner/170/" in u for u in api.urls)
    assert not any("/partner/000/" in u for u in api.urls)
    assert any(u.endswith("year/2019/datatype/aveestimated") for u in api.urls)
    assert not any(u.endswith("year/2020/datatype/aveestimated") for u in api.urls)

    summary = json.loads((base / "summary.json").read_text())
    assert summary["distribution"] == "local_only"
    assert summary["mfn_fallback_applied"] is False
    assert summary["locf_applied"] is False
    gaps = {(g["destination"], g["year"]) for g in summary["gaps"]}
    assert gaps == {("ESP", 2021), ("FRA", 2021)}
    assert summary["flags"]["n_non_hs6"] == 1
    meta = json.loads((base / "tariffs.csv.meta.json").read_text())
    assert meta["distribution"] == "local_only"


def test_force_refetches_and_unforced_rerun_is_skipped(tmp_path: Path) -> None:
    root = _root(tmp_path)
    api = FakeWits()
    wits.extract_live(
        "test-pull",
        root=root,
        config=_cfg(),
        fetch=api,
        sleep=lambda _s: None,
    )
    first_calls = len(api.urls)
    api2 = FakeWits()
    res = wits.extract_live(
        "test-pull",
        root=root,
        config=_cfg(),
        fetch=api2,
        sleep=lambda _s: None,
        force=True,  # rebuild table; XML cache is rebuilt too
    )
    assert res["rows"] == 10
    assert len(api2.urls) == first_calls
    # Table already present and not forced: skipped without any request.
    api3 = FakeWits()
    skipped = wits.extract_live("test-pull", root=root, config=_cfg(), fetch=api3)
    assert skipped["skipped"] is True and api3.urls == []


def test_cache_hit_avoids_requests(tmp_path: Path) -> None:
    root = _root(tmp_path)
    numeric = wits.load_iso3_numeric(root=root)
    xml_dir = tmp_path / "xml"
    api = FakeWits()
    kwargs = {
        "xml_dir": xml_dir,
        "sleep": lambda _s: None,
        "rate_limit_s": 0.0,
    }
    _t, s1 = wits.build_tariffs(_cfg(), numeric, fetch=api, force=False, **kwargs)
    n = len(api.urls)
    _t, s2 = wits.build_tariffs(_cfg(), numeric, fetch=api, force=False, **kwargs)
    assert len(api.urls) == n
    assert s1["n_requests"] == n and s2["n_requests"] == 0
    assert s2["n_cached"] == n


def test_rate_limit_sleeps_before_each_request(tmp_path: Path) -> None:
    root = _root(tmp_path)
    sleeps: list[float] = []
    api = FakeWits()
    wits.build_tariffs(
        _cfg(),
        wits.load_iso3_numeric(root=root),
        xml_dir=tmp_path / "x",
        fetch=api,
        sleep=sleeps.append,
        rate_limit_s=0.7,
        force=False,
    )
    assert len(sleeps) == len(api.urls) and set(sleeps) == {0.7}


def test_missing_config_is_source_unavailable(tmp_path: Path) -> None:
    with pytest.raises(SourceUnavailableError, match="wits_trains.json"):
        wits.live_version(root=tmp_path)


def test_config_roundtrip(tmp_path: Path) -> None:
    cfg_path = tmp_path / "config" / "wits_trains.json"
    cfg_path.parent.mkdir(parents=True)
    cfg_path.write_text(
        json.dumps(
            {
                "version": "v1",
                "reporters": ["esp"],
                "partners": ["col"],
                "years": [2019, 2021],
                "hs_chapters": ["64"],
            },
        ),
        encoding="utf-8",
    )
    cfg = wits.load_config(root=tmp_path)
    assert cfg.reporters == ("ESP",) and cfg.year_end == 2021
    assert wits.live_version(root=tmp_path) == "v1"


def test_wits_stays_local_only_in_registry() -> None:
    from imsatlas_etl.sources import sources_by_id

    rights = sources_by_id()["wits_trains"]["rights"]
    assert rights["redistribute_raw"] != "yes"
    assert rights["evidence"]["checked_by"] is None
