"""World Bank indicator codes used by the catalog (fixtures + live check)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.paths import repo_root

# Codes that appear as World Bank / WDI / WGI series in the catalog.
WB_CODE_RE = re.compile(r"^[A-Z]{2}(?:\.[A-Z0-9]+)+$")

FIXTURES_DIR = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "wb_indicators"
)


def world_bank_codes_from_catalog(data: dict[str, Any] | None = None) -> list[str]:
    """Return sorted unique WB-style indicator codes referenced by the catalog."""
    catalog = data or load_catalog()
    codes: set[str] = set()
    for var in catalog.get("variables", []):
        if not isinstance(var, dict):
            continue
        raw = str(var.get("code") or "")
        for part in re.split(r"[,/]", raw):
            code = part.strip()
            if WB_CODE_RE.match(code):
                codes.add(code)
        # Also accept a lone indicator in source_url path.
        url = str(var.get("source_url") or "")
        if "/indicator/" in url:
            tail = url.rstrip("/").split("/")[-1]
            if WB_CODE_RE.match(tail):
                codes.add(tail)
    return sorted(codes)


def fixture_path(code: str) -> Path:
    safe = code.replace(".", "_")
    return FIXTURES_DIR / f"{safe}.json"


def load_indicator_fixture(code: str) -> dict[str, Any]:
    path = fixture_path(code)
    if not path.is_file():
        raise FileNotFoundError(f"missing WB fixture for {code}: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path}: expected object")
    return payload


def assert_fixture_matches_code(code: str, payload: dict[str, Any]) -> None:
    """Validate the recorded /v2/indicator/<code> shape used by unit tests."""
    if payload.get("id") != code:
        raise AssertionError(f"fixture id {payload.get('id')!r} != {code!r}")
    if not payload.get("name"):
        raise AssertionError(f"fixture {code}: missing name")
    source = payload.get("source")
    if not isinstance(source, dict) or not source.get("value"):
        raise AssertionError(f"fixture {code}: missing source.value")


def write_minimal_fixture(code: str, *, name: str, source_value: str) -> Path:
    """Write a recorded-style fixture (no network). Used to seed unit tests."""
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "id": code,
        "name": name,
        "unit": "",
        "source": {"id": "2", "value": source_value},
        "sourceNote": "Recorded fixture for offline tests (Phase 1-fix).",
        "sourceOrganization": "World Bank",
        "endpoint": f"https://api.worldbank.org/v2/indicator/{code}?format=json",
    }
    path = fixture_path(code)
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return path


def live_fetch_indicator(code: str, *, timeout_s: float = 30.0) -> dict[str, Any]:
    """Network call for `make check-live` only — never used by unit tests."""
    import urllib.error
    import urllib.request

    url = f"https://api.worldbank.org/v2/indicator/{code}?format=json"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ims-atlas-etl/0.1 (check-live; no personal data)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:  # noqa: S310
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"WB API HTTP {exc.code} for {code}") from exc
    parsed = json.loads(body)
    if not isinstance(parsed, list) or len(parsed) < 2:
        raise RuntimeError(f"unexpected WB payload for {code}")
    rows = parsed[1]
    if not rows:
        raise RuntimeError(f"WB indicator not found: {code}")
    row = rows[0]
    if not isinstance(row, dict):
        raise RuntimeError(f"WB indicator row not an object: {code}")
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "unit": row.get("unit"),
        "source": row.get("source"),
        "sourceNote": row.get("sourceNote"),
        "sourceOrganization": row.get("sourceOrganization"),
        "endpoint": url,
    }


def check_live_all_catalog_codes() -> list[str]:
    """Fetch every catalog WB code; return list of problem messages (empty = ok)."""
    problems: list[str] = []
    for code in world_bank_codes_from_catalog():
        try:
            payload = live_fetch_indicator(code)
            if payload.get("id") != code:
                problems.append(f"{code}: API id mismatch {payload.get('id')!r}")
        except Exception as exc:  # noqa: BLE001 — report all live failures
            problems.append(f"{code}: {exc}")
    return problems


def seed_fixtures_from_catalog_metadata() -> list[Path]:
    """Create offline fixtures for every WB code currently in the catalog."""
    # Descriptive placeholders; `make check-live` confirms against the API.
    names: dict[str, tuple[str, str]] = {
        "NY.GDP.PCAP.PP.KD": (
            "GDP per capita, PPP (constant 2021 international $)",
            "World Development Indicators",
        ),
        "SP.POP.TOTL": ("Population, total", "World Development Indicators"),
        "LP.LPI.OVRL.XQ": (
            "Logistics performance index: Overall (1=low to 5=high)",
            "World Development Indicators",
        ),
        "FP.CPI.TOTL.ZG": (
            "Inflation, consumer prices (annual %)",
            "World Development Indicators",
        ),
        "SL.UEM.TOTL.ZS": (
            "Unemployment, total (% of total labor force) (modeled ILO estimate)",
            "World Development Indicators",
        ),
        "VA.EST": (
            "Voice and Accountability: Estimate",
            "Worldwide Governance Indicators",
        ),
        "PV.EST": (
            "Political Stability and Absence of Violence/Terrorism: Estimate",
            "Worldwide Governance Indicators",
        ),
        "GE.EST": (
            "Government Effectiveness: Estimate",
            "Worldwide Governance Indicators",
        ),
        "RQ.EST": ("Regulatory Quality: Estimate", "Worldwide Governance Indicators"),
        "RL.EST": ("Rule of Law: Estimate", "Worldwide Governance Indicators"),
        "CC.EST": (
            "Control of Corruption: Estimate",
            "Worldwide Governance Indicators",
        ),
        "NE.TRD.GNFS.ZS": (
            "Trade (% of GDP)",
            "World Development Indicators",
        ),
        "EN.GHG.CO2.PC.CE.AR5": (
            "CO2 emissions excluding LULUCF per capita (t CO2e/capita)",
            "World Development Indicators",
        ),
        "PA.NUS.PRVT.PLI": (
            "Price level ratio of PPP conversion factor (GDP) to market exchange rate",
            "World Development Indicators",
        ),
    }
    written: list[Path] = []
    for code in world_bank_codes_from_catalog():
        name, source = names.get(
            code,
            (f"World Bank indicator {code}", "World Development Indicators"),
        )
        written.append(write_minimal_fixture(code, name=name, source_value=source))
    # Ensure repo root relative path exists for docs.
    _ = repo_root()
    return written
