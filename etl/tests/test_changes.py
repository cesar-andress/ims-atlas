"""Change detection: pure diff (unit + property tests) and run bookkeeping."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from imsatlas_etl.pipeline.changes import (
    append_history,
    compare_source_tables,
    has_changes,
    history_entry,
    read_history,
    readable_source_summary,
    record_changes,
    update_variables_status,
    variables_status_fields,
)
from imsatlas_etl.pipeline.runner import run_pipeline

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


def _frame(rows: list[tuple[str, int, str, float | None]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["iso3", "year", "indicator", "value"])


PREV = _frame(
    [
        ("COL", 2021, "A", 1.0),
        ("COL", 2022, "A", 2.0),
        ("ESP", 2022, "A", 10.0),
        ("ESP", 2022, "B", 5.0),
    ],
)


def test_identical_tables_have_no_changes() -> None:
    diff = compare_source_tables(
        PREV, PREV.copy(), prev_version="v1", next_version="v1"
    )
    assert not has_changes(diff)
    assert diff["version"] == {"previous": "v1", "next": "v1", "changed": False}
    assert diff["revised"] == {"count": 0, "max_abs_change": 0.0, "top": []}


def test_new_year_country_cells_and_removed() -> None:
    nxt = _frame(
        [
            ("COL", 2021, "A", 1.0),
            ("COL", 2022, "A", 2.5),  # revised by 0.5
            ("COL", 2023, "A", 3.0),  # new year, new cell
            ("MEX", 2022, "A", 7.0),  # new country, new cell
            ("ESP", 2022, "A", 10.0),
            # ESP B removed
        ],
    )
    diff = compare_source_tables(PREV, nxt, prev_version="v1", next_version="v2")
    assert diff["new_years"] == [2023]
    assert diff["removed_years"] == []
    assert diff["new_countries"] == ["MEX"]
    assert diff["removed_countries"] == []
    assert diff["new_cells"] == 2
    assert diff["removed_cells"] == 1
    assert diff["new_cells_by_indicator"] == {"A": 2}
    assert diff["revised"]["count"] == 1
    assert diff["revised"]["max_abs_change"] == pytest.approx(0.5)
    top = diff["revised"]["top"][0]
    assert (top["iso3"], top["year"], top["previous"], top["next"]) == (
        "COL",
        2022,
        2.0,
        2.5,
    )
    assert diff["version"]["changed"] is True
    assert has_changes(diff)
    summary = readable_source_summary("worldbank_wdi", diff)
    assert summary.startswith("worldbank_wdi")
    assert "2023" in summary
    assert "revised" in summary


def test_null_to_value_counts_as_new_cell_and_value_to_null_as_removed() -> None:
    a = _frame([("COL", 2020, "A", None), ("COL", 2021, "A", 1.0)])
    b = _frame([("COL", 2020, "A", 4.0), ("COL", 2021, "A", None)])
    diff = compare_source_tables(a, b)
    assert diff["new_cells"] == 1 and diff["removed_cells"] == 1
    assert diff["revised"]["count"] == 0


def test_columns_added_and_removed() -> None:
    a = PREV.assign(old=1.0)
    b = PREV.assign(new=2.0)
    diff = compare_source_tables(a, b)
    assert diff["columns_added"] == ["new"]
    assert diff["columns_removed"] == ["old"]
    assert has_changes(diff)


def test_top_is_capped_and_sorted() -> None:
    years = list(range(2000, 2030))
    a = _frame([("COL", y, "A", float(y)) for y in years])
    b = _frame([("COL", y, "A", float(y) + (y - 1999)) for y in years])
    diff = compare_source_tables(a, b)
    assert diff["revised"]["count"] == 30
    assert len(diff["revised"]["top"]) == 10
    changes = [r["abs_change"] for r in diff["revised"]["top"]]
    assert changes == sorted(changes, reverse=True)
    assert diff["revised"]["max_abs_change"] == 30.0


def test_hofstede_style_table_without_year_or_indicator() -> None:
    a = pd.DataFrame({"iso3": ["COL", "ESP"], "pdi": [67.0, 57.0]})
    b = pd.DataFrame({"iso3": ["COL", "ESP", "MEX"], "pdi": [68.0, 57.0, 81.0]})
    diff = compare_source_tables(a, b)
    assert diff["keys"] == ["iso3"]
    assert diff["new_years"] == []
    assert diff["new_countries"] == ["MEX"]
    assert diff["revised"]["count"] == 1
    assert diff["new_cells"] == 1


def test_bilateral_countries_use_origin_and_destination() -> None:
    a = pd.DataFrame(
        {"origin": ["COL"], "destination": ["ESP"], "year": [2020], "distw": [1.0]},
    )
    b = pd.DataFrame(
        {"origin": ["COL"], "destination": ["FRA"], "year": [2020], "distw": [1.0]},
    )
    diff = compare_source_tables(a, b)
    assert diff["new_countries"] == ["FRA"]
    assert diff["removed_countries"] == ["ESP"]


def test_duplicate_keys_are_reported_not_hidden() -> None:
    dup = pd.concat([PREV, PREV.iloc[[0]]], ignore_index=True)
    diff = compare_source_tables(dup, PREV)
    assert diff["duplicate_keys_previous"] == 1
    assert not has_changes(diff)


def test_no_shared_keys_raises() -> None:
    with pytest.raises(ValueError, match="no shared key"):
        compare_source_tables(pd.DataFrame({"a": [1]}), pd.DataFrame({"b": [1]}))


# --- property tests ----------------------------------------------------------

iso = st.sampled_from(["COL", "ESP", "MEX", "CHL"])
ind = st.sampled_from(["A", "B"])
rows = st.lists(
    st.tuples(
        iso,
        st.integers(2000, 2006),
        ind,
        st.one_of(st.none(), st.integers(-5, 5).map(float)),
    ),
    max_size=25,
)


@given(rows)
@settings(max_examples=60, deadline=None)
def test_property_self_diff_is_empty(data: list) -> None:
    frame = _frame(data)
    if frame.empty:
        frame = _frame([("COL", 2000, "A", 1.0)])
    assert not has_changes(compare_source_tables(frame, frame.copy()))


@given(rows, rows)
@settings(max_examples=80, deadline=None)
def test_property_swap_symmetry(a: list, b: list) -> None:
    fa, fb = _frame(a), _frame(b)
    if fa.empty or fb.empty:
        return
    fwd = compare_source_tables(fa, fb)
    rev = compare_source_tables(fb, fa)
    assert fwd["new_cells"] == rev["removed_cells"]
    assert fwd["removed_cells"] == rev["new_cells"]
    assert fwd["new_years"] == rev["removed_years"]
    assert fwd["new_countries"] == rev["removed_countries"]
    assert fwd["revised"]["count"] == rev["revised"]["count"]
    assert fwd["revised"]["max_abs_change"] == rev["revised"]["max_abs_change"]


@given(rows, rows)
@settings(max_examples=80, deadline=None)
def test_property_revision_summary_is_consistent(a: list, b: list) -> None:
    fa, fb = _frame(a), _frame(b)
    if fa.empty or fb.empty:
        return
    rev = compare_source_tables(fa, fb)["revised"]
    top = rev["top"]
    assert len(top) == min(10, rev["count"])
    if rev["count"]:
        assert rev["max_abs_change"] == top[0]["abs_change"] > 0
        assert all(r["abs_change"] <= rev["max_abs_change"] for r in top)
    else:
        assert rev["max_abs_change"] == 0.0


@given(rows, rows)
@settings(max_examples=60, deadline=None)
def test_property_deterministic(a: list, b: list) -> None:
    fa, fb = _frame(a), _frame(b)
    if fa.empty or fb.empty:
        return
    one = json.dumps(compare_source_tables(fa, fb), sort_keys=True)
    two = json.dumps(compare_source_tables(fa.copy(), fb.copy()), sort_keys=True)
    assert one == two


@given(rows, st.integers(2010, 2020))
@settings(max_examples=40, deadline=None)
def test_property_added_year_is_detected(a: list, year: int) -> None:
    fa = _frame(a) if a else _frame([("COL", 2000, "A", 1.0)])
    fb = pd.concat([fa, _frame([("COL", year, "A", 9.0)])], ignore_index=True)
    diff = compare_source_tables(fa, fb)
    assert diff["new_years"] == [year]
    assert diff["new_cells"] == 1


# --- bookkeeping ---------------------------------------------------------------


def test_record_changes_first_ingest_then_compare(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    run_pipeline(fixture_root=FIXTURE_ROOT, root=tmp_path, force=True)
    results = [{"source": "worldbank_wdi", "version": "mini-2022", "skipped": False}]
    first = record_changes("run-1", mode="fixture", results=results, root=tmp_path)
    assert first["sources"]["worldbank_wdi"]["status"] == "first_ingest"

    # A newer raw version with one extra year and a revised value.
    raw = tmp_path / "data/raw/worldbank_wdi"
    new_dir = raw / "mini-2023"
    new_dir.mkdir()
    table = pd.read_csv(raw / "mini-2022" / "indicators.csv")
    table.loc[0, "value"] = table.loc[0, "value"] + 1.5
    extra = table.iloc[[0]].copy()
    extra["year"] = 2023
    pd.concat([table, extra]).to_csv(new_dir / "indicators.csv", index=False)

    second = record_changes(
        "run-2",
        mode="fixture",
        results=[{"source": "worldbank_wdi", "version": "mini-2023"}],
        root=tmp_path,
    )
    diff = second["sources"]["worldbank_wdi"]
    assert diff["status"] == "compared"
    assert diff["new_years"] == [2023]
    assert diff["new_cells"] == 1
    assert diff["revised"]["count"] == 1
    assert diff["revised"]["max_abs_change"] == pytest.approx(1.5)
    assert diff["version"] == {
        "previous": "mini-2022",
        "next": "mini-2023",
        "changed": True,
    }
    stored = json.loads((tmp_path / "status/changes/run-2.json").read_text())
    assert stored["mode"] == "fixture" and stored["is_fixture"] is True

    skipped = record_changes(
        "run-3",
        mode="fixture",
        results=[{"source": "worldbank_wdi", "version": "mini-2023", "skipped": True}],
        root=tmp_path,
    )
    assert skipped["sources"]["worldbank_wdi"]["status"] == "skipped_existing"


def test_history_appends_one_line_per_run(tmp_path: Path) -> None:
    log = {
        "run_id": "r1",
        "mode": "live",
        "status": "ok",
        "started_at": "t0",
        "ended_at": "t1",
        "sources": ["worldbank_wdi"],
        "steps": {
            "extract": {
                "results": [
                    {"source": "worldbank_wdi", "version": "2024", "skipped": False},
                ],
            },
            "qa": {"report_status": "pass"},
        },
    }
    append_history(history_entry(log, None), root=tmp_path)
    append_history(history_entry({**log, "run_id": "r2"}, None), root=tmp_path)
    lines = (tmp_path / "status/history.jsonl").read_text().splitlines()
    assert len(lines) == 2
    entry = json.loads(lines[0])
    assert entry["run_id"] == "r1" and entry["mode"] == "live"
    assert entry["versions"] == {"worldbank_wdi": "2024"}
    assert entry["ingested"] == ["worldbank_wdi"]
    assert entry["qa_status"] == "pass"
    assert [e["run_id"] for e in read_history(root=tmp_path)] == ["r1", "r2"]


def test_variable_status_fields_from_history_and_changes(tmp_path: Path) -> None:
    changes = tmp_path / "status/changes"
    changes.mkdir(parents=True)
    (changes / "r1.json").write_text(
        json.dumps(
            {
                "sources": {
                    "worldbank_wdi": {
                        "status": "compared",
                        "keys": ["iso3", "year", "indicator"],
                        "new_cells_by_indicator": {"SP.POP.TOTL": 3, "OTHER": 9},
                    },
                    "baci": {"status": "first_ingest"},
                },
            },
        ),
    )
    append_history(
        {
            "run_id": "r1",
            "ended_at": "2026-01-02T00:00:00Z",
            "ingested": ["worldbank_wdi"],
        },
        root=tmp_path,
    )
    freshness = {
        "sources": [
            {
                "source": "worldbank_wdi",
                "checked_at": "2026-01-03T00:00:00Z",
                "upstream_changed_at": "2025-12-31",
            },
            {"source": "baci", "checked_at": "2026-01-03T00:00:00Z"},
        ],
    }
    variables = [
        {"id": "IMPC", "code": "SP.POP.TOTL", "source_ids": ["baci", "worldbank_wdi"]},
        {"id": "IMPV", "code": "value", "source_ids": ["baci"]},
    ]
    fields = variables_status_fields(variables, freshness, root=tmp_path)
    assert fields["IMPC"] == {
        "last_checked": "2026-01-03T00:00:00Z",
        "last_upstream_change": "2025-12-31",
        "last_ingested": "2026-01-02T00:00:00Z",
        "new_cells_since_previous": 3,
    }
    assert fields["IMPV"]["new_cells_since_previous"] is None
    assert fields["IMPV"]["last_ingested"] is None


def test_update_variables_status_patches_existing_file(tmp_path: Path) -> None:
    assert update_variables_status(root=tmp_path) is None
    status = tmp_path / "status"
    status.mkdir()
    (status / "freshness.json").write_text(
        json.dumps({"sources": [{"source": "baci", "checked_at": "c"}]}),
    )
    (status / "variables.json").write_text(
        json.dumps(
            {"variables": [{"id": "IMPV", "code": "value", "source_ids": ["baci"]}]}
        ),
    )
    path = update_variables_status(root=tmp_path)
    assert path is not None
    row = json.loads(path.read_text())["variables"][0]
    assert row["last_checked"] == "c"
    assert "new_cells_since_previous" in row
