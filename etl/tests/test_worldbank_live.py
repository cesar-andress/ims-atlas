"""World Bank live extract against recorded-shape fixtures (no network)."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.connectors.http import (
    HttpResponse,
    SourceUnavailableError,
    backoff_delay,
    fetch_response,
)
from imsatlas_etl.contracts.schemas import indicators_schema

FIX = Path(__file__).parent / "fixtures" / "wb_live"


class FakeApi:
    """Route World Bank URLs to the recorded fixture bytes; log every call."""

    def __init__(self) -> None:
        self.urls: list[str] = []

    def __call__(self, url: str) -> tuple[bytes, dict[str, str]]:
        self.urls.append(url)
        if "/country?" in url:
            name = "countries_p1.json"
        else:
            code = url.split("/indicator/")[1].split("?")[0]
            page = url.rsplit("page=", 1)[1]
            name = f"{code}_p{page}.json"
        return (FIX / name).read_bytes(), {"Content-Type": "application/json"}


def _run(
    tmp_path: Path,
    codes: list[str],
    sleeps: list[float] | None = None,
    api: FakeApi | None = None,
) -> dict:
    log = sleeps if sleeps is not None else []
    return wb.extract_live(
        "worldbank_wdi",
        "2024-03-28",
        root=tmp_path,
        codes=codes,
        fetch=api or FakeApi(),
        sleep=log.append,
        rate_limit_s=0.25,
    )


def test_single_page_extract_writes_pages_csv_and_summary(tmp_path: Path) -> None:
    res = _run(tmp_path, ["NY.GDP.PCAP.PP.KD"])
    assert res["rows"] == 1
    assert res["countries"] == 1
    assert res["years"] == [2023, 2023]
    assert res["upstream_version"] == "2024-01-15"
    assert res["lastupdated"] == {"NY.GDP.PCAP.PP.KD": "2024-01-15"}

    base = tmp_path / "data" / "raw" / "worldbank_wdi" / "2024-03-28"
    page = base / "pages" / "NY.GDP.PCAP.PP.KD_p1.json"
    assert page.is_file()
    meta = json.loads((page.parent / (page.name + ".meta.json")).read_text())
    assert meta["mode"] == "live"
    assert meta["url"].endswith(f"per_page={wb.PER_PAGE}&page=1")
    assert len(meta["sha256"]) == 64

    frame = wb.load_raw_indicators(base / "indicators.csv")
    assert frame.to_dict("records") == [
        {"iso3": "COL", "year": 2023, "indicator": "NY.GDP.PCAP.PP.KD", "value": 123.4},
    ]
    indicators_schema.validate(frame)
    summary = json.loads((base / "summary.json").read_text())
    assert summary["indicators"]["NY.GDP.PCAP.PP.KD"]["lastupdated"] == "2024-01-15"
    assert summary["aggregate_codes_excluded"] == ["WLD"]


def test_pagination_discards_are_counted_not_silent(tmp_path: Path) -> None:
    sleeps: list[float] = []
    api = FakeApi()
    res = _run(tmp_path, ["SP.POP.TOTL"], sleeps, api)
    pages = [u for u in api.urls if "SP.POP.TOTL" in u]
    assert [u.rsplit("page=", 1)[1] for u in pages] == ["1", "2"]
    # polite sleep between the two pages (and after the indicator)
    assert sleeps.count(0.25) >= 2
    assert res["rows"] == 2  # COL 2022, ESP 2022
    summary = json.loads(
        (tmp_path / "data/raw/worldbank_wdi/2024-03-28/summary.json").read_text(),
    )
    stats = summary["indicators"]["SP.POP.TOTL"]
    assert stats["pages"] == 2
    assert stats["n_api_rows"] == 6
    assert stats["n_kept"] == 2
    assert stats["n_aggregate"] == 1
    assert stats["n_before_min_year"] == 1
    assert stats["n_null_value"] == 1
    assert stats["n_unknown_iso3"] == 1
    assert (
        stats["n_kept"]
        + stats["n_aggregate"]
        + stats["n_before_min_year"]
        + stats["n_null_value"]
        + stats["n_unknown_iso3"]
        == stats["n_api_rows"]
    )


def test_upstream_version_is_latest_lastupdated(tmp_path: Path) -> None:
    res = _run(tmp_path, ["NY.GDP.PCAP.PP.KD", "SP.POP.TOTL"])
    assert res["upstream_version"] == "2024-03-28"
    assert res["countries"] == 2
    frame = pd.read_csv(Path(res["path"]))
    assert list(frame["indicator"]) == [
        "NY.GDP.PCAP.PP.KD",
        "SP.POP.TOTL",
        "SP.POP.TOTL",
    ]


def test_second_call_is_skipped_unless_forced(tmp_path: Path) -> None:
    _run(tmp_path, ["NY.GDP.PCAP.PP.KD"])
    api = FakeApi()
    again = _run(tmp_path, ["NY.GDP.PCAP.PP.KD"], api=api)
    assert again["skipped"] is True
    assert api.urls == []
    forced = wb.extract_live(
        "worldbank_wdi",
        "2024-03-28",
        root=tmp_path,
        force=True,
        codes=["NY.GDP.PCAP.PP.KD"],
        fetch=FakeApi(),
        sleep=lambda _s: None,
    )
    assert forced["skipped"] is False


def test_extract_is_deterministic(tmp_path: Path) -> None:
    a = _run(tmp_path / "a", ["SP.POP.TOTL", "NY.GDP.PCAP.PP.KD"])
    b = _run(tmp_path / "b", ["SP.POP.TOTL", "NY.GDP.PCAP.PP.KD"])
    assert Path(a["path"]).read_bytes() == Path(b["path"]).read_bytes()


def test_api_error_payload_raises() -> None:
    with pytest.raises(ValueError, match="API error"):
        wb.parse_page((FIX / "error.json").read_bytes(), label="x")


def test_codes_for_source_come_from_catalog() -> None:
    assert "GDPPC" not in wb.codes_for_source("worldbank_wdi")
    assert "NY.GDP.PCAP.PP.KD" in wb.codes_for_source("worldbank_wdi")
    assert "CC.EST" in wb.codes_for_source("worldbank_wgi")
    assert wb.codes_for_source("worldbank_lpi") == ["LP.LPI.OVRL.XQ"]


def test_wgi_codes_are_aggregate_estimates_only() -> None:
    """R2 / WGI caveat: CC BY covers aggregate estimates, not third-party components."""
    codes = wb.codes_for_source("worldbank_wgi")
    assert codes, "expected WGI indicator codes"
    for code in codes:
        assert code.endswith(".EST"), code
        assert "PER.RNK" not in code and "NO.SRC" not in code
    # Live API aliases must also be estimate series only.
    for catalog_code, api_code in wb.WGI_API_ALIASES.items():
        assert catalog_code.endswith(".EST")
        assert api_code.startswith("GOV_WGI_") and api_code.endswith(".EST")


def test_indicator_url_matches_catalog_template() -> None:
    assert wb.indicator_page_url("CC.EST", 3) == (
        "https://api.worldbank.org/v2/country/all/indicator/CC.EST"
        f"?format=json&per_page={wb.PER_PAGE}&page=3"
    )


def test_per_page_avoids_wb_truncation_bug() -> None:
    """GOV_WGI_CC.EST with per_page=20000 returned only 2 years (2026-11-21)."""
    assert wb.PER_PAGE <= 5000


# --- retry / backoff -------------------------------------------------------


class _Resp:
    def __init__(self, status: int, body: bytes = b"ok", headers=None) -> None:
        self.status_code = status
        self.content = body
        self.headers = headers or {}


class _Session:
    def __init__(self, statuses: list[int]) -> None:
        self.headers: dict[str, str] = {}
        self.statuses = list(statuses)
        self.calls = 0

    def get(self, url: str, timeout: float) -> _Resp:
        self.calls += 1
        return _Resp(self.statuses.pop(0))


def test_backoff_is_exponential_and_capped() -> None:
    assert [backoff_delay(i, sleep_base=1.0) for i in (1, 2, 3, 4)] == [1, 2, 4, 8]
    assert backoff_delay(10, sleep_base=1.0, max_sleep=5.0) == 5.0
    assert backoff_delay(1, retry_after="7") == 7.0
    assert backoff_delay(2, sleep_base=1.0, retry_after="soon") == 2.0


def test_fetch_response_retries_transient_status() -> None:
    sleeps: list[float] = []
    sess = _Session([503, 429, 200])
    out = fetch_response(
        "https://example.invalid/x",
        sleep=sleeps.append,
        session=sess,  # type: ignore[arg-type]
        sleep_base=1.0,
    )
    assert isinstance(out, HttpResponse) and out.status == 200
    assert sess.calls == 3
    assert sleeps == [1.0, 2.0]


def test_fetch_response_gives_up_as_source_unavailable() -> None:
    sess = _Session([500, 500, 500])
    with pytest.raises(SourceUnavailableError, match="HTTP 500"):
        fetch_response(
            "https://example.invalid/x",
            attempts=3,
            sleep=lambda _s: None,
            session=sess,  # type: ignore[arg-type]
        )
    assert sess.calls == 3


def test_fetch_response_does_not_retry_client_errors() -> None:
    sess = _Session([403, 200])
    with pytest.raises(SourceUnavailableError, match="HTTP 403"):
        fetch_response(
            "https://example.invalid/x",
            sleep=lambda _s: None,
            session=sess,  # type: ignore[arg-type]
        )
    assert sess.calls == 1
