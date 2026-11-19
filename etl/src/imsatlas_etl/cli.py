"""Typer CLI entrypoint for atlas-etl."""

from __future__ import annotations

from typing import Annotated

import typer

from imsatlas_etl import __version__
from imsatlas_etl.catalog import (
    CatalogValidationError,
    assert_valid_catalog,
    load_catalog,
    write_licenses_md,
)
from imsatlas_etl.paths import catalog_yaml_path, licenses_md_path, rights_md_path
from imsatlas_etl.port_catalog import build_catalog_from_backtest, write_catalog_yaml
from imsatlas_etl.rights import (
    rights_verify,
    write_rights_md,
)
from imsatlas_etl.sources import (
    SourcesValidationError,
    assert_valid_sources,
    load_sources,
)
from imsatlas_etl.verify import verify_variable
from imsatlas_etl.wb_indicators import check_live_all_catalog_codes

app = typer.Typer(add_completion=False, no_args_is_help=True, help="IMS Atlas ETL")


@app.callback()
def main() -> None:
    """IMS Atlas ETL commands."""


@app.command("catalog-validate")
def catalog_validate(
    write_licenses: Annotated[
        bool,
        typer.Option(
            "--write-licenses/--no-write-licenses",
            help="Regenerate catalog/LICENSES.md after a successful validation",
        ),
    ] = True,
) -> None:
    """Validate catalog/variables.yaml against SPEC §4 rules."""
    path = catalog_yaml_path()
    if not path.is_file():
        typer.secho(f"missing catalog: {path}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)
    try:
        data = load_catalog(path)
        assert_valid_catalog(data)
    except CatalogValidationError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc

    n_vars = len(data.get("variables", []))
    typer.echo(f"atlas-etl {__version__}: catalog-validate ok ({n_vars} variables)")
    if write_licenses:
        out = write_licenses_md(data)
        typer.echo(f"wrote {out.relative_to(path.parent.parent)}")


@app.command("catalog-port")
def catalog_port() -> None:
    """Port pinned imsfe variables.yaml into catalog/variables.yaml (+ draft vars)."""
    catalog = build_catalog_from_backtest()
    out = write_catalog_yaml(catalog)
    write_licenses_md(catalog)
    n_vars = len(catalog["variables"])
    typer.echo(
        f"atlas-etl {__version__}: catalog-port wrote {out} ({n_vars} variables); "
        f"also {licenses_md_path()}",
    )


@app.command("verify")
def verify(
    var_id: Annotated[str, typer.Argument(help="Variable id to mark verified")],
    by: Annotated[
        str,
        typer.Option("--by", help="Human name recording the verification"),
    ],
    on: Annotated[
        str | None,
        typer.Option("--on", help="UTC date YYYY-MM-DD (default: today)"),
    ] = None,
) -> None:
    """Human-only: set status=verified and record verified_by / verified_on."""
    try:
        result = verify_variable(var_id, by=by, on=on)
    except CatalogValidationError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    write_licenses_md()
    typer.echo(
        f"atlas-etl {__version__}: verified {result['id']} "
        f"by {result['verified_by']} on {result['verified_on']}",
    )


@app.command("check-live")
def check_live() -> None:
    """Network: confirm every catalog World Bank code exists in the live API."""
    problems = check_live_all_catalog_codes()
    if problems:
        for problem in problems:
            typer.secho(problem, fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)
    typer.echo(f"atlas-etl {__version__}: check-live ok (all WB codes found)")


@app.command("rights-report")
def rights_report() -> None:
    """Validate sources + catalog and write catalog/RIGHTS.md."""
    try:
        assert_valid_sources(load_sources())
        assert_valid_catalog(load_catalog())
        out = write_rights_md()
        write_licenses_md()
    except (CatalogValidationError, SourcesValidationError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"atlas-etl {__version__}: wrote {out}")


@app.command("rights-verify")
def rights_verify_cmd(
    source_id: Annotated[str, typer.Argument(help="Source id in sources.yaml")],
    by: Annotated[
        str,
        typer.Option("--by", help="Human name recording the rights check"),
    ],
    on: Annotated[
        str | None,
        typer.Option("--on", help="UTC date YYYY-MM-DD (default: today)"),
    ] = None,
    note: Annotated[
        str | None,
        typer.Option("--note", help="Optional paraphrase of the relevant clause"),
    ] = None,
) -> None:
    """Human-only: fetch terms page, store sha256, set evidence.checked_by/on."""
    try:
        result = rights_verify(source_id, by=by, on=on, note=note)
        write_rights_md()
    except SourcesValidationError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"atlas-etl {__version__}: rights-verify {result['id']} "
        f"by {result['checked_by']} on {result['checked_on']} "
        f"sha256={result['snapshot_sha256'][:16]}… "
        f"(rights flags still need human yes/no edits; see {rights_md_path()})",
    )


def _parse_sources(raw: str | None) -> list[str] | None:
    if raw is None or raw.strip() == "" or raw.strip() == "all":
        return None
    return [part.strip() for part in raw.split(",") if part.strip()]


@app.command("check")
def check_cmd(
    source: Annotated[
        str | None,
        typer.Option("--source", help="Comma-separated source ids, or all"),
    ] = None,
    fixture_root: Annotated[
        str | None,
        typer.Option(
            "--fixture-root",
            help="Offline fixtures directory (no network)",
        ),
    ] = None,
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Probe upstream versions -> status/freshness.json."""
    from pathlib import Path

    from imsatlas_etl.pipeline.check import run_check

    rows = run_check(
        sources=_parse_sources(source),
        fixture_root=Path(fixture_root) if fixture_root else None,
        force=force,
    )
    stale = sum(1 for r in rows if r.get("stale"))
    typer.echo(
        f"atlas-etl {__version__}: check ok ({len(rows)} sources, {stale} stale)",
    )


@app.command("extract")
def extract_cmd(
    source: Annotated[
        str | None,
        typer.Option("--source", help="Comma-separated source ids, or all"),
    ] = None,
    fixture_root: Annotated[
        str | None,
        typer.Option("--fixture-root", help="Offline fixtures directory"),
    ] = None,
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Download/copy into data/raw/<source>/<version>/."""
    from pathlib import Path

    from imsatlas_etl.pipeline.extract import run_extract

    if fixture_root is None:
        typer.secho(
            "extract currently requires --fixture-root (live zip/API extract Phase 2+)",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    results = run_extract(
        sources=_parse_sources(source),
        fixture_root=Path(fixture_root),
        force=force,
    )
    typer.echo(f"atlas-etl {__version__}: extract ok ({len(results)} sources)")


@app.command("validate")
def validate_cmd(
    source: Annotated[
        str | None,
        typer.Option("--source", help="Comma-separated source ids, or all"),
    ] = None,
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Validate raw tables against pandera contracts."""
    from imsatlas_etl.pipeline.validate import run_validate

    try:
        results = run_validate(sources=_parse_sources(source), force=force)
    except ValueError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"atlas-etl {__version__}: validate ok ({len(results)} sources)")


@app.command("transform")
def transform_cmd(
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Build curated country/bilateral/trade tables."""
    from imsatlas_etl.pipeline.transform import run_transform

    result = run_transform(force=force)
    counts = result["row_counts"]
    typer.echo(
        f"atlas-etl {__version__}: transform ok "
        f"(country_year={counts['country_year']}, "
        f"bilateral_year={counts['bilateral_year']}, "
        f"trade_hs6={counts['trade_hs6']})",
    )


@app.command("run")
def run_cmd(
    source: Annotated[
        str | None,
        typer.Option("--source", help="Comma-separated source ids, or all"),
    ] = None,
    fixture_root: Annotated[
        str | None,
        typer.Option("--fixture-root", help="Offline fixtures directory"),
    ] = None,
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Run check -> extract -> validate -> transform (DAG)."""
    from pathlib import Path

    from imsatlas_etl.pipeline.runner import run_pipeline

    if fixture_root is None:
        typer.secho(
            "run currently requires --fixture-root for extract",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    try:
        log = run_pipeline(
            sources=_parse_sources(source),
            fixture_root=Path(fixture_root),
            force=force,
        )
    except Exception as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    counts = log.get("steps", {}).get("transform", {}).get("row_counts", {})
    typer.echo(
        f"atlas-etl {__version__}: run ok id={log['run_id']} rows={counts}",
    )


@app.command("build")
def build(
    fixture_root: Annotated[
        str | None,
        typer.Option("--fixture-root", help="Offline fixtures directory"),
    ] = None,
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Alias for `run` (full DAG)."""
    run_cmd(source=None, fixture_root=fixture_root, force=force)


@app.command("qa")
def qa_cmd(
    series_breaks: Annotated[
        str | None,
        typer.Option(
            "--series-breaks",
            help="Comma-separated break years to flag if present",
        ),
    ] = None,
) -> None:
    """Run curated QA rules -> status/qa.json and status/qa.md."""
    from imsatlas_etl.pipeline.qa import run_qa

    breaks = None
    if series_breaks:
        breaks = [
            int(part.strip()) for part in series_breaks.split(",") if part.strip()
        ]
    report = run_qa(series_breaks=breaks)
    typer.echo(
        f"atlas-etl {__version__}: qa {report['status']} "
        f"(block={report['n_block']} warn={report['n_warn']})",
    )
    if report["status"] == "fail":
        raise typer.Exit(code=1)


@app.command("lineage")
def lineage_cmd() -> None:
    """Write status/lineage.json DAG."""
    from imsatlas_etl.pipeline.lineage import write_lineage

    path = write_lineage()
    typer.echo(f"atlas-etl {__version__}: wrote {path}")


@app.command("release")
def release_cmd(
    version: Annotated[
        str,
        typer.Option("--version", help="Release version (e.g. 0.1.0)"),
    ] = "0.1.0",
    staging: Annotated[
        bool,
        typer.Option("--staging/--public", help="Write staging (default) or public"),
    ] = True,
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Build SPEC §3 data/release/staging|public/vX.Y.Z (gate-filtered)."""
    from imsatlas_etl.pipeline.release import run_release, write_zenodo_dataset_json

    try:
        result = run_release(version, staging=staging, force=force)
        zenodo = write_zenodo_dataset_json(version=version)
    except (FileExistsError, FileNotFoundError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    sizes = result.get("size_bytes") or {}
    typer.echo(
        f"atlas-etl {__version__}: release v{result['version']} "
        f"staging={result['staging']} files={result['n_files']} "
        f"included_vars={result['n_included_variables']} "
        f"bytes={sizes.get('total_bytes', 0)} -> {result['path']}",
    )
    typer.echo(f"wrote {zenodo}")


@app.command("promote")
def promote_cmd(
    version: Annotated[str, typer.Argument(help="Version to promote (e.g. 0.1.0)")],
    by: Annotated[str, typer.Option("--by", help="Human approving promotion")],
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Promote staging release to public data/release/public/vX.Y.Z."""
    from imsatlas_etl.pipeline.promote import promote_release

    try:
        result = promote_release(version, by=by, force=force)
    except (FileExistsError, FileNotFoundError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"atlas-etl {__version__}: promoted v{result['version']} "
        f"by {result['promoted_by']} -> {result['path']}",
    )


@app.command("coverage-report")
def coverage_report_cmd() -> None:
    """Write countries×years coverage CSV+PNG under status/coverage/."""
    from imsatlas_etl.pipeline.coverage import run_coverage_reports

    try:
        result = run_coverage_reports()
    except FileNotFoundError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    ok = sum(1 for r in result["reports"] if r.get("status") == "ok")
    typer.echo(
        f"atlas-etl {__version__}: coverage-report ok "
        f"({ok}/{len(result['reports'])}) -> {result['out_dir']}",
    )


@app.command("phase3-report")
def phase3_report_cmd() -> None:
    """Write status/phase3_variables.md summary for new variables."""
    from imsatlas_etl.pipeline.phase3_report import write_phase3_report

    path = write_phase3_report()
    typer.echo(f"atlas-etl {__version__}: wrote {path}")


@app.command("export-catalog-preview")
def export_catalog_preview_cmd(
    out: Annotated[
        str | None,
        typer.Option(
            "--out",
            help="Output JSON (default: app/public/meta/catalog-preview.json)",
        ),
    ] = None,
) -> None:
    """Export draft catalog preview JSON for the app Data catalog view."""
    from pathlib import Path

    from imsatlas_etl.export_catalog_preview import write_catalog_preview

    try:
        path = write_catalog_preview(Path(out) if out else None)
    except Exception as exc:  # noqa: BLE001
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"atlas-etl {__version__}: wrote {path}")


@app.command("export-phase6-goldens")
def export_phase6_goldens_cmd(
    out: Annotated[
        str | None,
        typer.Option(
            "--out",
            help="Output JSON (default: core/fixtures/phase6/golden.json)",
        ),
    ] = None,
) -> None:
    """Export ims-backtest golden fixtures for core/ Vitest (Phase 6)."""
    from pathlib import Path

    from imsatlas_etl.export_phase6_goldens import write_phase6_goldens

    try:
        path = write_phase6_goldens(Path(out) if out else None)
    except Exception as exc:  # noqa: BLE001 — surface imsfe failures
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"atlas-etl {__version__}: wrote {path}")


@app.command("export-phase5-goldens")
def export_phase5_goldens_cmd(
    out: Annotated[
        str | None,
        typer.Option(
            "--out",
            help="Output JSON (default: core/fixtures/phase5/golden.json)",
        ),
    ] = None,
) -> None:
    """Export ims-backtest golden fixtures for core/ Vitest (Phase 5)."""
    from pathlib import Path

    from imsatlas_etl.export_phase5_goldens import write_phase5_goldens

    try:
        path = write_phase5_goldens(Path(out) if out else None)
    except Exception as exc:  # noqa: BLE001 — surface imsfe/pymcdm failures
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"atlas-etl {__version__}: wrote {path}")


@app.command("check-alert")
def check_alert_cmd(
    fixture_root: Annotated[
        str | None,
        typer.Option("--fixture-root", help="Offline fixtures directory"),
    ] = None,
    open_issue: Annotated[
        bool,
        typer.Option(
            "--open-issue/--no-open-issue",
            help="Open GitHub issue via gh if GITHUB_TOKEN/GH_TOKEN set",
        ),
    ] = False,
) -> None:
    """Scheduled check + stale alert (log; optional gh issue)."""
    from pathlib import Path

    from imsatlas_etl.pipeline.alert import check_and_alert

    result = check_and_alert(
        fixture_root=Path(fixture_root) if fixture_root else None,
        open_issue=open_issue,
    )
    typer.echo(
        f"atlas-etl {__version__}: check-alert "
        f"stale={result['n_stale']}/{result['n_sources']} "
        f"alert={result['alert_path'] or 'none'}",
    )


if __name__ == "__main__":
    app()
