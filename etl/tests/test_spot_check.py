from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest
from typer.testing import CliRunner

from imsatlas_etl.cli import app
from imsatlas_etl.connectors.http import SourceUnavailableError
from imsatlas_etl.pipeline.promote import promote_release
from imsatlas_etl.pipeline.release import run_release
from imsatlas_etl.pipeline.spot_check import (
    cell_url,
    checkable_cells,
    compare_value,
    fixture_response_name,
    run_spot_check,
    sample_cells,
    spot_check_path,
    upstream_value,
)

runner = CliRunner()


def _wb_body(iso3: str, year: int, value: float | None) -> bytes:
    payload = [
        {"page": 1, "pages": 1, "per_page": 50, "total": 1, "lastupdated": "t"},
        [{"countryiso3code": iso3, "date": str(year), "value": value}],
    ]
    return json.dumps(payload).encode("utf-8")


def _record_responses(
    release: Path,
    out: Path,
    *,
    perturb: tuple[str, str, int] | None = None,
    skip: tuple[str, str, int] | None = None,
) -> None:
    """Test-only recorded responses derived from the release's own values."""
    prov = pd.read_parquet(release / "provenance.parquet")
    out.mkdir(parents=True, exist_ok=True)
    for r in checkable_cells(prov).itertuples(index=False):
        key = (str(r.variable_id), str(r.iso3), int(r.year))
        if key == skip:
            continue
        value = float(r.value) + (1.0 if key == perturb else 0.0)
        name = fixture_response_name(str(r.iso3), str(r.upstream_code), int(r.year))
        (out / name).write_bytes(_wb_body(str(r.iso3), int(r.year), value))


def _public_with_cells(world_root: Path) -> Path:
    run_release("0.1.0", root=world_root, staging=True, force=True)
    return Path(promote_release("0.1.0", by="Tester", root=world_root)["path"])


def test_sampling_is_seeded_and_deterministic() -> None:
    cells = pd.DataFrame({"k": range(50)})
    a = sample_cells(cells, 10, seed=1)
    b = sample_cells(cells, 10, seed=1)
    c = sample_cells(cells, 10, seed=2)
    assert a["k"].tolist() == b["k"].tolist()
    assert a["k"].tolist() != c["k"].tolist()
    assert len(set(a["k"])) == 10
    assert len(sample_cells(cells, 500, seed=1)) == 50
    assert sample_cells(cells, 0, seed=1).empty


def test_upstream_value_and_compare() -> None:
    assert upstream_value(_wb_body("ESP", 2022, 4.9), 2022) == 4.9
    assert upstream_value(_wb_body("ESP", 2022, None), 2022) is None
    assert upstream_value(_wb_body("ESP", 2022, 4.9), 2021) is None
    assert compare_value(4.9, 4.9)
    assert compare_value(4.9, 4.9 * (1 + 1e-12))
    assert not compare_value(4.9, 4.91)
    assert not compare_value(4.9, None)


def test_cell_url_uses_api_alias_for_wgi() -> None:
    assert cell_url("ESP", "CC.EST", 2022) == (
        "https://api.worldbank.org/v2/country/ESP/indicator/GOV_WGI_CC.EST"
        "?format=json&date=2022"
    )


def test_empty_release_writes_empty_spot_check(world_root: Path) -> None:
    _public_with_cells(world_root)
    report = run_spot_check(n=200, seed=1, root=world_root)
    assert report["n_sampled"] == 0
    assert (report["matches"], report["mismatches"], report["unreachable"]) == (0,) * 3
    assert report["samples"] == [] and report["seed"] == 1 and report["n"] == 200
    assert "0 cells" in report["note"]
    on_disk = json.loads(spot_check_path(root=world_root).read_text("utf-8"))
    assert on_disk["n_sampled"] == 0 and on_disk["release"] == "v0.1.0"


def test_no_public_release_writes_empty_spot_check(tmp_path: Path) -> None:
    report = run_spot_check(n=5, seed=3, root=tmp_path)
    assert report["n_sampled"] == 0 and report["release"] is None
    assert spot_check_path(root=tmp_path).is_file()


def test_fixture_responses_all_match(
    world_root: Path,
    ship_cell_variables: frozenset[str],
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    release = _public_with_cells(world_root)
    responses = tmp_path_factory.mktemp("responses")
    _record_responses(release, responses)
    report = run_spot_check(
        n=200,
        seed=1,
        root=world_root,
        fixture_responses=responses,
    )
    wb_cells = {"CO2PC", "PLI"}
    assert report["n_sampled"] == report["n_cells_checkable"] == 18
    assert {s["variable_id"] for s in report["samples"]} == wb_cells
    assert report["matches"] == 18
    assert report["mismatches"] == 0 and report["unreachable"] == 0
    assert report["n_cells_population"] > report["n_cells_checkable"]


def test_mismatch_and_unreachable_are_counted(
    world_root: Path,
    ship_cell_variables: frozenset[str],
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    release = _public_with_cells(world_root)
    responses = tmp_path_factory.mktemp("responses")
    _record_responses(
        release,
        responses,
        perturb=("CO2PC", "ESP", 2022),
        skip=("PLI", "MEX", 2021),
    )
    report = run_spot_check(n=200, seed=1, root=world_root, fixture_responses=responses)
    assert (report["matches"], report["mismatches"], report["unreachable"]) == (
        16,
        1,
        1,
    )
    bad = [s for s in report["samples"] if s["status"] == "mismatch"][0]
    assert bad["upstream_value"] == pytest.approx(bad["release_value"] + 1.0)


def test_injected_fetch_error_is_unreachable(
    world_root: Path,
    ship_cell_variables: frozenset[str],
) -> None:
    _public_with_cells(world_root)

    def down(_url: str) -> bytes:
        raise SourceUnavailableError("offline")

    report = run_spot_check(n=3, seed=1, root=world_root, fetch=down, write=False)
    assert report["n_sampled"] == 3 and report["unreachable"] == 3
    assert not spot_check_path(root=world_root).exists()


def test_cli_spot_check_empty_public_release(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    result = runner.invoke(app, ["spot-check", "--n", "0", "--seed", "1"])
    assert result.exit_code == 0, result.output
    assert "sampled=0" in result.output
    assert (tmp_path / "status" / "spot_check.json").is_file()
