"""Step 3 connectors (CPI, INFORM, GII, Doing Business, manual UNCTAD/IMF).

All bytes come from ``tests/fixtures/step3_live`` (synthetic, layout-faithful
test doubles) and are injected through ``fetch`` / ``head``. No network.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import pandas as pd
import pytest
import requests

from imsatlas_etl.connectors import (
    cpi,
    doing_business,
    inform,
    manual_drop,
    wipo_gii,
)
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.connectors.country_index import load_raw_values
from imsatlas_etl.connectors.http import SourceUnavailableError
from imsatlas_etl.connectors.xlsx_min import Workbook, XlsxError
from imsatlas_etl.contracts.schemas import index_values_schema, indicators_schema
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline import check as check_mod
from imsatlas_etl.pipeline.extract import extract_source
from imsatlas_etl.pipeline.io_paths import (
    PIPELINE_SOURCES,
    STEP3_SOURCES,
    freshness_path,
)
from imsatlas_etl.pipeline.runner import run_pipeline
from imsatlas_etl.pipeline.step3_sources import summarize_step3_sources
from imsatlas_etl.pipeline.transform import run_transform

FIX = Path(__file__).parent / "fixtures" / "step3_live"
MINI = Path(__file__).parent / "fixtures" / "mini_world"


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def blocked(*_a: object, **_k: object) -> None:
        raise AssertionError("network access attempted in a Step 3 test")

    monkeypatch.setattr(requests.Session, "request", blocked)


def _fetcher(routes: dict[str, tuple[bytes, dict[str, str]]]):
    calls: list[str] = []

    def fetch(url: str) -> tuple[bytes, dict[str, str]]:
        calls.append(url)
        if url not in routes:
            raise SourceUnavailableError(f"no recorded response for {url}")
        return routes[url]

    fetch.calls = calls  # type: ignore[attr-defined]
    return fetch


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --- xlsx_min --------------------------------------------------------------


def test_xlsx_reader_handles_strict_shared_strings_and_transitional_inline() -> None:
    strict = Workbook((FIX / "CPI_results_shape.xlsx").read_bytes())
    assert strict.find_sheet(r"^CPI Timeseries") == "CPI Timeseries 2012 - 2025"
    rows = dict(strict.iter_rows("CPI Timeseries 2012 - 2025"))
    assert rows[4]["B"] == "ISO3" and rows[5]["D"] == 80.0
    assert 3 not in rows  # empty row is skipped

    plain = Workbook((FIX / "GII_2025_shape.xlsx").read_bytes())
    assert plain.sheet_names == ["Index Structure", "Economies", "Data", "Metadata"]
    first = next(iter(plain.iter_rows("Data")))[1]
    assert first["A"] == "ISO3"


def test_xlsx_reader_errors_are_explicit() -> None:
    with pytest.raises(XlsxError, match="not a zip"):
        Workbook(b"not an xlsx")
    book = Workbook((FIX / "GII_2025_shape.xlsx").read_bytes())
    with pytest.raises(XlsxError, match="exactly one sheet"):
        book.find_sheet("nope")
    with pytest.raises(XlsxError, match="no sheet"):
        list(book.iter_rows("nope"))


# --- CPI -------------------------------------------------------------------

CPI_URL = cpi.RELEASES[0].url
CPI_HEADERS = {"Last-Modified": "Wed, 04 Feb 2026 10:21:12 GMT"}


def test_cpi_parse_counts_every_discard() -> None:
    table, counts = cpi.parse_workbook((FIX / "CPI_results_shape.xlsx").read_bytes())
    got = {(r.iso3, r.year): r.value for r in table.itertuples()}
    assert got == {
        ("TSA", 2025): 80.0,
        ("TSA", 2024): 79.0,
        ("TSB", 2025): 40.0,
        ("TSC", 2025): 20.0,
        ("TSC", 2024): 21.0,
    }
    assert counts["n_null_score"] == 1  # TSB 2024
    assert counts["n_non_country_rows"] == 1  # footnote row
    assert counts["n_kept"] == 5
    assert counts["sheet"] == "CPI Timeseries 2012 - 2025"


def test_cpi_parse_rejects_wrong_layout() -> None:
    with pytest.raises(ValueError, match="CPI Timeseries|exactly one sheet"):
        cpi.parse_workbook((FIX / "GII_2025_shape.xlsx").read_bytes())


def test_cpi_probe_uses_head_last_modified_not_download() -> None:
    seen: list[str] = []

    def head(url: str) -> dict[str, str]:
        seen.append(url)
        return CPI_HEADERS

    probe = cpi.probe_version(head=head)
    assert probe["upstream_version"] == "cpi2025-20260204"
    assert probe["upstream_changed_at"] == "2026-02-04"
    assert seen == [CPI_URL]


def test_cpi_extract_live_writes_verbatim_and_normalised(tmp_path: Path) -> None:
    body = (FIX / "CPI_results_shape.xlsx").read_bytes()
    fetch = _fetcher({CPI_URL: (body, CPI_HEADERS)})
    res = cpi.extract_live("cpi2025-20260204", root=tmp_path, fetch=fetch)
    out = Path(res["path"])
    assert out.name == "values.csv" and res["rows"] == 5 and res["countries"] == 3
    assert res["years"] == [2024, 2025]
    verbatim = out.parent / "source.xlsx"
    assert verbatim.read_bytes() == body
    meta = json.loads((out.parent / "source.xlsx.meta.json").read_text())
    assert meta["sha256"] == hashlib.sha256(body).hexdigest()
    assert meta["url"] == CPI_URL and meta["mode"] == "live"
    summary = json.loads((out.parent / "summary.json").read_text())
    assert summary["parse"]["n_null_score"] == 1
    frame, unmatched = load_raw_values(out)
    assert unmatched == []
    index_values_schema.validate(frame)
    # second call is a no-op (no network)
    again = cpi.extract_live("cpi2025-20260204", root=tmp_path, fetch=fetch)
    assert again["skipped"] is True and len(fetch.calls) == 1


def test_cpi_manual_drop_wins_over_network(tmp_path: Path) -> None:
    drop = tmp_path / "data/manual/transparency_cpi/values.csv"
    drop.parent.mkdir(parents=True)
    drop.write_bytes((MINI / "transparency_cpi/values.csv").read_bytes())
    version = cpi.live_version(root=tmp_path, head=lambda _u: pytest.fail("head"))
    assert version.startswith("manual-")
    fetch = _fetcher({})
    res = cpi.extract_live(version, root=tmp_path, fetch=fetch)
    assert fetch.calls == []
    meta = json.loads(Path(res["path"] + ".meta.json").read_text())
    assert meta["input"] == "manual_drop"


# --- INFORM ----------------------------------------------------------------

PKG_BYTES = (FIX / "hdx_package_show.json").read_bytes()


def test_inform_probe_reads_resource_last_modified() -> None:
    probe = inform.probe_version(fetch=_fetcher({inform.PACKAGE_URL: (PKG_BYTES, {})}))
    assert probe["upstream_version"] == "hdx-20260102"


def test_inform_probe_fails_closed_when_resource_missing() -> None:
    body = json.dumps({"success": True, "result": {"resources": []}}).encode()
    with pytest.raises(SourceUnavailableError, match="trends resource"):
        inform.probe_version(fetch=_fetcher({inform.PACKAGE_URL: (body, {})}))


def test_inform_parse_keeps_only_overall_index_and_counts_discards() -> None:
    table, counts = inform.parse_trends(
        (FIX / "inform_risk_index_trends.csv").read_bytes(),
    )
    got = {(r.iso3, r.year): r.value for r in table.itertuples()}
    assert got == {("TSA", 2024): 2.5, ("TSA", 2025): 2.6, ("TSB", 2024): 6.5}
    assert counts["n_input_rows"] == 10
    assert counts["n_other_indicator"] == 5  # HA / VU / CC rows
    assert counts["n_null_value"] == 1  # TSB 2025
    assert counts["n_bad_iso3"] == 1  # 2-letter code
    assert counts["n_kept"] == 3


def test_inform_parse_rejects_duplicates_and_missing_columns() -> None:
    dup = (
        b"CountryName,Iso3,GNAYear,IndicatorId,FullName,IndicatorScore\n"
        b"A,TSA,2024,INFORM,x,1.0\nA,TSA,2024,INFORM,x,2.0\n"
    )
    with pytest.raises(ValueError, match="duplicate"):
        inform.parse_trends(dup)
    with pytest.raises(ValueError, match="missing columns"):
        inform.parse_trends(b"Iso3,GNAYear\nTSA,2024\n")


def test_inform_extract_live_from_recorded_responses(tmp_path: Path) -> None:
    body = (FIX / "inform_risk_index_trends.csv").read_bytes()
    fetch = _fetcher(
        {
            inform.PACKAGE_URL: (PKG_BYTES, {}),
            inform.RESOURCE_URL: (body, {"Content-Type": "text/csv"}),
        },
    )
    res = inform.extract_live("hdx-20260102", root=tmp_path, fetch=fetch)
    out = Path(res["path"])
    assert res["rows"] == 3 and res["countries"] == 2 and res["years"] == [2024, 2025]
    assert (out.parent / "inform_risk_index_trends.csv").read_bytes() == body
    meta = json.loads((out.parent / "values.csv.meta.json").read_text())
    assert (
        meta["mode"] == "live"
        and meta["source_sha256"]["inform_risk_index_trends.csv"]
        == hashlib.sha256(body).hexdigest()
    )
    frame, _ = load_raw_values(out)
    index_values_schema.validate(frame)
    assert "amazonaws" not in json.dumps(meta)  # signed redirect never stored


# --- WIPO GII --------------------------------------------------------------


def test_gii_probe_uses_latest_edition_head() -> None:
    seen: list[str] = []

    def head(url: str) -> dict[str, str]:
        seen.append(url)
        return {"last-modified": "Mon, 28 Sep 2026 15:34:13 GMT"}

    probe = wipo_gii.probe_version(head=head)
    assert probe["upstream_version"] == "gii2026-20260928"
    assert seen == [wipo_gii.EDITIONS[0].url]


def test_gii_extract_live_reads_overall_score_per_edition(tmp_path: Path) -> None:
    routes = {
        wipo_gii.EDITIONS[0].url: (
            (FIX / "GII_2026_shape.xlsx").read_bytes(),
            {"Last-Modified": "Mon, 28 Sep 2026 15:34:13 GMT"},
        ),
        wipo_gii.EDITIONS[1].url: ((FIX / "GII_2025_shape.xlsx").read_bytes(), {}),
    }
    res = wipo_gii.extract_live(
        "gii2026-20260928",
        root=tmp_path,
        fetch=_fetcher(routes),
    )
    frame = pd.read_csv(res["path"])
    got = {(r.iso3, r.year): round(r.value, 6) for r in frame.itertuples()}
    assert got[("TSA", 2025)] == 60.0 and got[("TSA", 2026)] == 61.5
    assert len(frame) == 6  # 3 economies x 2 editions; TSD has no score
    assert res["years"] == [2025, 2026]
    summary = json.loads((Path(res["path"]).parent / "summary.json").read_text())
    assert summary["parse"]["2026"]["n_null"] == 1
    assert {p.name for p in Path(res["path"]).parent.glob("gii*.xlsx")} == {
        "gii2025.xlsx",
        "gii2026.xlsx",
    }


# --- Doing Business --------------------------------------------------------


def test_doing_business_parse_keeps_headline_series_only() -> None:
    table, counts = doing_business.parse_zip((FIX / "DB_CSV_shape.zip").read_bytes())
    got = {(r.iso3, r.year, r.indicator): r.value for r in table.itertuples()}
    assert got == {
        ("TSA", 2017, "IC.BUS.EASE.DFRN.XQ.DB1719"): 70.5,
        ("TSA", 2018, "IC.BUS.EASE.DFRN.XQ.DB1719"): 71.5,
        ("TSA", 2017, "IC.BUS.EASE.XQ"): 10.0,
        ("TSA", 2018, "IC.BUS.EASE.XQ"): 9.0,
        ("TSA", 2019, "IC.BUS.EASE.XQ"): 8.0,
        ("TSB", 2018, "IC.BUS.EASE.XQ"): 20.0,
        ("TSB", 2019, "IC.BUS.EASE.XQ"): 21.0,
    }
    assert counts["n_other_indicator"] == 1  # IC.CNST.PRMT...
    assert counts["n_not_economy"] == 2  # subnational + aggregate
    assert counts["n_null_value"] == 2
    indicators_schema.validate(table)


def test_doing_business_extract_live_and_probe(tmp_path: Path) -> None:
    body = (FIX / "DB_CSV_shape.zip").read_bytes()
    headers = {"Last-Modified": "Thu, 15 Feb 2024 15:15:12 GMT"}
    probe = doing_business.probe_version(head=lambda _u: headers)
    assert probe["upstream_version"] == "db-20240215"
    res = doing_business.extract_live(
        "db-20240215",
        root=tmp_path,
        fetch=_fetcher({doing_business.ZIP_URL: (body, headers)}),
    )
    out = Path(res["path"])
    assert out.name == "indicators.csv" and res["rows"] == 7 and res["countries"] == 2
    assert (out.parent / "DB_CSV.zip").read_bytes() == body
    assert wb.load_raw_indicators(out)["indicator"].nunique() == 2


def test_doing_business_rejects_unexpected_archive() -> None:
    with pytest.raises(ValueError, match="unexpected archive"):
        doing_business.parse_zip(b"not a zip")


# --- manual-only: unctadstat, imf_weo --------------------------------------


@pytest.mark.parametrize("source_id", ["unctadstat", "imf_weo"])
def test_manual_only_sources_roundtrip_and_missing_reason(
    tmp_path: Path,
    source_id: str,
) -> None:
    with pytest.raises(SourceUnavailableError, match="manual drop"):
        check_mod._live_probe(source_id, root=tmp_path)
    drop = tmp_path / "data/manual" / source_id / "indicators.csv"
    drop.parent.mkdir(parents=True)
    drop.write_bytes((MINI / source_id / "indicators.csv").read_bytes())
    probe = check_mod._live_probe(source_id, root=tmp_path)
    res = extract_source(
        source_id,
        probe["upstream_version"],
        fixture_root=None,
        root=tmp_path,
    )
    frame = wb.load_raw_indicators(Path(res["path"]))
    indicators_schema.validate(frame)
    assert Path(res["path"]).read_bytes() == drop.read_bytes()
    assert manual_drop.is_manual_source(source_id)


# --- pipeline wiring -------------------------------------------------------


def test_step3_sources_are_registered_pipeline_sources() -> None:
    for source_id in STEP3_SOURCES:
        assert source_id in PIPELINE_SOURCES
    assert {"inform_risk", "transparency_cpi", "worldbank_doing_business"} <= set(
        PIPELINE_SOURCES,
    )
    assert {"unctadstat", "imf_weo"} <= set(PIPELINE_SOURCES)


def test_fixture_transform_fills_variables_and_reports_coverage(
    tmp_path: Path,
) -> None:
    log = run_pipeline(
        steps=["check", "extract", "validate", "transform"],
        fixture_root=MINI,
        root=tmp_path,
        force=True,
    )
    coverage = log["steps"]["transform"]["source_coverage"]
    assert set(coverage) == set(STEP3_SOURCES)
    for source_id, info in coverage.items():
        assert info["status"] == "ok", (source_id, info)
        assert info["rows"] > 0 and info["countries"] == 3 and info["years"]
    frame = pd.read_parquet(tmp_path / "data/curated/variables_country_year.parquet")
    assert float(
        frame[(frame["iso3"] == "ESP") & (frame["year"] == 2021)]["INRI"].iloc[0],
    ) == pytest.approx(3.2)
    assert float(
        frame[(frame["iso3"] == "MEX") & (frame["year"] == 2022)]["CPIN"].iloc[0],
    ) == pytest.approx(62.0)
    assert not [m for m in log["missing_sources"] if m["id"] in STEP3_SOURCES]


def test_missing_manual_sources_appear_in_missing_sources_with_reason(
    tmp_path: Path,
) -> None:
    for name in ("catalog", "config"):
        shutil.copytree(repo_root() / name, tmp_path / name)
    # Only inform_risk was ingested; the others have no freshness row.
    run_pipeline(
        steps=["check", "extract"],
        sources=["inform_risk"],
        fixture_root=MINI,
        root=tmp_path,
        force=True,
    )
    payload = json.loads(freshness_path(root=tmp_path).read_text())
    assert [r["source"] for r in payload["sources"]] == ["inform_risk"]
    result = run_transform(root=tmp_path)
    cov = result["source_coverage"]
    assert cov["inform_risk"]["status"] == "ok"
    for source_id in ("unctadstat", "imf_weo", "transparency_cpi"):
        assert cov[source_id]["status"] == "missing"
        assert f"data/manual/{source_id}/README.md" in cov[source_id]["reason"]
    ids = {m["id"] for m in result["missing_sources"]}
    assert {"unctadstat", "imf_weo"} <= ids


def test_summary_marks_unreadable_raw_table(tmp_path: Path) -> None:
    base = tmp_path / "data/raw/imf_weo/v1"
    base.mkdir(parents=True)
    (base / "indicators.csv").write_text("iso3,year\nESP,2020\n")
    missing: list[dict[str, str]] = []
    out = summarize_step3_sources({"imf_weo": "v1"}, root=tmp_path, missing=missing)
    assert out["imf_weo"]["status"] == "missing"
    assert "unreadable" in out["imf_weo"]["reason"]
    assert any(m["id"] == "imf_weo" for m in missing)


# --- docs ------------------------------------------------------------------


def test_manual_drop_note_lists_every_manual_source_and_verified_urls() -> None:
    text = (repo_root() / "docs" / "step3-manual-drops.md").read_text(encoding="utf-8")
    for source_id in STEP3_SOURCES:
        assert f"`{source_id}`" in text
    assert "https://files.transparencycdn.org/images/CPI2025_Results.xlsx" in text
    assert "https://data.imf.org/datasets/WEO" in text
