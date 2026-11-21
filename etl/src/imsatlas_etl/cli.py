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
    rights_set,
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

EXIT_FAILURE = 1  # QA block or any pipeline failure
EXIT_UNREACHABLE = 2  # upstream unreachable or required manual drop missing

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
        typer.Option("--by", help="Human name / initials recording the rights check"),
    ],
    on: Annotated[
        str | None,
        typer.Option("--on", help="UTC date YYYY-MM-DD (default: today)"),
    ] = None,
    note: Annotated[
        str | None,
        typer.Option("--note", help="Optional paraphrase of the relevant clause"),
    ] = None,
    basis: Annotated[
        str | None,
        typer.Option(
            "--basis",
            help="public_terms | subscription | contract | written_permission",
        ),
    ] = None,
    scope: Annotated[
        str | None,
        typer.Option(
            "--scope",
            help="use | redistribute_derived | redistribute_raw | commercial",
        ),
    ] = None,
    document: Annotated[
        str | None,
        typer.Option(
            "--document",
            help="Reference only (contract no., email date); never paste secrets",
        ),
    ] = None,
    no_fetch: Annotated[
        bool,
        typer.Option("--no-fetch", help="Skip downloading terms_url"),
    ] = False,
) -> None:
    """Human-only: record basis/scope/document ref + optional terms snapshot."""
    try:
        result = rights_verify(
            source_id,
            by=by,
            on=on,
            note=note,
            basis=basis,
            scope=scope,
            document=document,
            fetch=not no_fetch,
        )
        write_rights_md()
    except SourcesValidationError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    sha = result.get("snapshot_sha256") or "none"
    sha_short = sha[:16] + "…" if isinstance(sha, str) and len(sha) > 16 else sha
    typer.echo(
        f"atlas-etl {__version__}: rights-verify {result['id']} "
        f"by {result['checked_by']} on {result['checked_on']} "
        f"basis={result.get('basis')} scope={result.get('scope')} "
        f"sha256={sha_short} "
        f"(yes/no rights flags still need human edits; see {rights_md_path()})",
    )


@app.command("rights-set")
def rights_set_cmd(
    source_id: Annotated[str, typer.Argument(help="Source id in sources.yaml")],
    by: Annotated[
        str,
        typer.Option("--by", help="Human name / initials recording the flag change"),
    ],
    use_research: Annotated[
        str,
        typer.Option(
            "--use-research",
            help="yes | no | unknown",
        ),
    ],
    note: Annotated[
        str,
        typer.Option("--note", help="Clause / basis paraphrase (required)"),
    ],
    basis: Annotated[
        str | None,
        typer.Option(
            "--basis",
            help="public_terms | subscription | contract | written_permission",
        ),
    ] = None,
    dry_run: Annotated[
        bool,
        typer.Option("--dry-run", help="Print the change without writing YAML"),
    ] = False,
) -> None:
    """Human-only: set use_research (+ evidence). Agents: --dry-run only."""
    try:
        result = rights_set(
            source_id,
            by=by,
            use_research=use_research,
            note=note,
            basis=basis,
            dry_run=dry_run,
        )
        if not dry_run:
            write_rights_md()
    except SourcesValidationError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    prefix = "DRY-RUN " if result.get("dry_run") else ""
    before = result["use_research_before"]
    after = result["use_research_after"]
    typer.echo(
        f"atlas-etl {__version__}: {prefix}rights-set {result['id']} "
        f"use_research {before} → {after} "
        f"by {result['by']} on {result['on']}",
    )


@app.command("link-check")
def link_check_cmd(
    offline: Annotated[
        bool,
        typer.Option("--offline", help="Do not hit the network; write stub report"),
    ] = False,
) -> None:
    """Probe workbook + landing URLs → status/link_check.json."""
    from imsatlas_etl.link_check import run_link_check

    report = run_link_check(offline=offline)
    typer.echo(
        f"atlas-etl {__version__}: link-check "
        f"{report['n_checked']} urls, {report['n_dead_or_error']} dead/error "
        f"→ status/link_check.json",
    )


@app.command("imsfe-import")
def imsfe_import_cmd(
    workbook: Annotated[
        str,
        typer.Argument(help="Path to an IMSFE/IMSFEM .xlsx (local; never committed)"),
    ],
    out: Annotated[
        str | None,
        typer.Option(
            "--out",
            help="Write anonymised import report JSON (no personal names, no path)",
        ),
    ] = None,
) -> None:
    """Phase A1: read workbook → final scores + anonymised import report."""
    import json
    from pathlib import Path

    from imsatlas_etl.imsfe_workbook import (
        assert_no_personal_names,
        read_imsfe_workbook,
    )

    path = Path(workbook)
    try:
        report = read_imsfe_workbook(path)
        assert_no_personal_names(report)
    except (OSError, ValueError, AssertionError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc

    payload = report.to_dict()
    typer.echo(
        f"atlas-etl {__version__}: imsfe-import {report.path_label} "
        f"origin={report.origin} hs={report.hs_code} "
        f"criteria={report.n_criteria} vars={report.n_variables} "
        f"experts={report.n_experts} countries={len(report.final_scores)}",
    )
    if report.warnings:
        for w in report.warnings:
            typer.secho(f"  warning: {w}", fg=typer.colors.YELLOW, err=True)
    if out:
        out_path = Path(out)
        out_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        typer.echo(f"wrote {out_path}")


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

    from imsatlas_etl.connectors.http import SourceUnavailableError
    from imsatlas_etl.pipeline.check import run_check

    try:
        rows = run_check(
            sources=_parse_sources(source),
            fixture_root=Path(fixture_root) if fixture_root else None,
            force=force,
        )
    except SourceUnavailableError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=EXIT_UNREACHABLE) from exc
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
    """Copy fixtures, or (no --fixture-root) pull live / ingest manual drops."""
    from pathlib import Path

    from imsatlas_etl.connectors.http import SourceUnavailableError
    from imsatlas_etl.pipeline.extract import run_extract

    try:
        results = run_extract(
            sources=_parse_sources(source),
            fixture_root=Path(fixture_root) if fixture_root else None,
            force=force,
        )
    except SourceUnavailableError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=EXIT_UNREACHABLE) from exc
    typer.echo(f"atlas-etl {__version__}: extract ok ({len(results)} sources)")


@app.command("hourly")
def hourly_cmd(
    source: Annotated[
        str | None,
        typer.Option("--source", help="Comma-separated source ids, or all hourly"),
    ] = None,
    force: Annotated[bool, typer.Option("--force")] = False,
    check_only: Annotated[
        bool,
        typer.Option("--check-only", help="Probe versions without extracting"),
    ] = False,
) -> None:
    """R-0 hourly tick: per-source check/extract with sources_state.json."""
    from imsatlas_etl.pipeline.hourly import run_hourly

    out = run_hourly(
        sources=_parse_sources(source),
        force=force,
        extract=not check_only,
    )
    summary = out.get("summary") or {}
    typer.echo(
        f"atlas-etl {__version__}: hourly ok={out.get('n_ok')} "
        f"fail={out.get('n_fail')} sources={summary.get('ok')}/{summary.get('total')}",
    )


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
    live: Annotated[
        bool,
        typer.Option(
            "--live",
            help=(
                "Live run (mode=live): check, extract, validate, transform, qa, "
                "lineage, stores. Exit 0 ok, 1 QA block/failure, 2 source unreachable."
            ),
        ),
    ] = False,
    access_mode: Annotated[
        str | None,
        typer.Option(
            "--access-mode",
            help=(
                "ABIERTO (abierta sources only) or CERRADO (all). "
                "Default: deployment.yaml"
            ),
        ),
    ] = None,
) -> None:
    """Run the DAG: fixture mode (--fixture-root) or live mode (--live)."""
    from pathlib import Path

    from imsatlas_etl.connectors.http import SourceUnavailableError
    from imsatlas_etl.pipeline.runner import run_pipeline

    if live and fixture_root is not None:
        typer.secho(
            "--live and --fixture-root are mutually exclusive",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    if not live and fixture_root is None:
        typer.secho(
            "run requires --fixture-root (offline) or --live",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    try:
        log = run_pipeline(
            sources=_parse_sources(source),
            fixture_root=Path(fixture_root) if fixture_root else None,
            force=force,
            access_mode=access_mode,
        )
    except SourceUnavailableError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=EXIT_UNREACHABLE) from exc
    except Exception as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=EXIT_FAILURE) from exc
    counts = log.get("steps", {}).get("transform", {}).get("row_counts", {})
    typer.echo(
        f"atlas-etl {__version__}: run {log['status']} mode={log['mode']} "
        f"access={log.get('access_mode')} id={log['run_id']} rows={counts}",
    )
    if log["status"] == "qa_blocked":
        typer.secho("QA blocked: see status/qa.md", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=EXIT_FAILURE)


@app.command("build")
def build(
    fixture_root: Annotated[
        str | None,
        typer.Option("--fixture-root", help="Offline fixtures directory"),
    ] = None,
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Alias for `run` in fixture mode (full DAG)."""
    run_cmd(source=None, fixture_root=fixture_root, force=force, live=False)


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


@app.command("release-dual")
def release_dual_cmd(
    version: Annotated[
        str,
        typer.Option("--version", help="Release version (e.g. 1.2.0)"),
    ] = "1.2.0",
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Stage public + internal releases and write the Phase R dual report."""
    from imsatlas_etl.pipeline.release import (
        run_release,
        write_dual_release_report,
        write_zenodo_dataset_json,
    )

    try:
        public = run_release(
            version,
            staging=True,
            force=force,
            audience="public",
        )
        internal = run_release(
            version,
            staging=True,
            force=force,
            audience="internal",
        )
        report = write_dual_release_report(
            version,
            public_result=public,
            internal_result=internal,
        )
        zenodo = write_zenodo_dataset_json(version=version)
    except (FileExistsError, FileNotFoundError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"atlas-etl {__version__}: dual staging v{version} "
        f"public_vars={public['n_included_variables']} "
        f"internal_vars={internal['n_included_variables']} "
        f"report={report}",
    )
    typer.echo(f"wrote {zenodo}")


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
    audience: Annotated[
        str,
        typer.Option(
            "--audience",
            help="public (redistribute_*) or internal (use_research+evidence)",
        ),
    ] = "public",
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Build SPEC §3 data/release/staging|public|internal/vX.Y.Z (gate-filtered)."""
    from imsatlas_etl.pipeline.release import run_release, write_zenodo_dataset_json

    try:
        result = run_release(
            version,
            staging=staging,
            force=force,
            audience=audience,
        )
        zenodo = write_zenodo_dataset_json(version=version)
    except (FileExistsError, FileNotFoundError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    sizes = result.get("size_bytes") or {}
    typer.echo(
        f"atlas-etl {__version__}: release v{result['version']} "
        f"audience={result.get('audience', audience)} "
        f"staging={result['staging']} files={result['n_files']} "
        f"included_vars={result['n_included_variables']} "
        f"bytes={sizes.get('total_bytes', 0)} -> {result['path']}",
    )
    typer.echo(f"wrote {zenodo}")


@app.command("promote")
def promote_cmd(
    version: Annotated[str, typer.Argument(help="Version to promote (e.g. 0.1.0)")],
    by: Annotated[str, typer.Option("--by", help="Human approving promotion")],
    audience: Annotated[
        str,
        typer.Option("--audience", help="public or internal"),
    ] = "public",
    force: Annotated[bool, typer.Option("--force")] = False,
) -> None:
    """Promote staging release to public or internal data/release/.../vX.Y.Z."""
    from imsatlas_etl.pipeline.promote import promote_release

    try:
        result = promote_release(
            version,
            by=by,
            force=force,
            audience=audience,
        )
    except (FileExistsError, FileNotFoundError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"atlas-etl {__version__}: promoted v{result['version']} "
        f"audience={result.get('audience', audience)} "
        f"by {result['promoted_by']} -> {result['path']}",
    )


@app.command("verify-release")
def verify_release_cmd(
    release_dir: Annotated[
        str,
        typer.Argument(help="Release directory (e.g. data/release/public/v1.0.0)"),
    ],
) -> None:
    """Recompute hashes vs SHA256SUMS and manifest.json (exit 1 on mismatch)."""
    from pathlib import Path

    from imsatlas_etl.pipeline.integrity import verify_release

    result = verify_release(Path(release_dir))
    if not result["ok"]:
        for problem in result["problems"]:
            typer.secho(problem, fg=typer.colors.RED, err=True)
        typer.secho(
            f"atlas-etl {__version__}: verify-release FAILED "
            f"({len(result['problems'])} problems)",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    typer.echo(
        f"atlas-etl {__version__}: verify-release ok ({result['n_files']} files)",
    )


@app.command("reproduce-release")
def reproduce_release_cmd(
    version: Annotated[str, typer.Option("--version", help="Release version")],
    fixture_root: Annotated[
        str | None,
        typer.Option(
            "--fixture-root",
            help="Rebuild curated tables from recorded fixtures (CI, no network)",
        ),
    ] = None,
    reference: Annotated[
        str,
        typer.Option(
            "--reference", help="auto (public, else staging) | public | staging"
        ),
    ] = "auto",
    allow_extra: Annotated[
        bool,
        typer.Option(
            "--allow-extra/--no-allow-extra",
            help="Tolerate files/manifest keys only in the rebuild (older releases)",
        ),
    ] = False,
) -> None:
    """Rebuild a release and diff it byte-for-byte against the reference tree."""
    from pathlib import Path

    from imsatlas_etl.pipeline.reproduce import reproduce_release

    try:
        result = reproduce_release(
            version.removeprefix("v"),
            fixture_root=Path(fixture_root) if fixture_root else None,
            reference=reference,
            allow_extra=allow_extra,
        )
    except (FileNotFoundError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    if not result["ok"]:
        for key in (
            "missing_in_candidate",
            "extra_in_candidate",
            "differing",
            "manifest_fields_differing",
            "manifest_fields_extra_in_candidate",
        ):
            for item in result[key]:
                typer.secho(f"{key}: {item}", fg=typer.colors.RED, err=True)
        typer.secho(
            f"atlas-etl {__version__}: reproduce-release v{result['version']} "
            f"DIFFERS from {result['reference']}",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    typer.echo(
        f"atlas-etl {__version__}: reproduce-release v{result['version']} "
        f"matches {result['reference']} (mode={result['mode']})",
    )


@app.command("spot-check")
def spot_check_cmd(
    n: Annotated[int, typer.Option("--n", help="Cells to sample")] = 200,
    seed: Annotated[int, typer.Option("--seed", help="Sampling seed")] = 1,
    fixture_responses: Annotated[
        str | None,
        typer.Option(
            "--fixture-responses",
            help="Directory of recorded World Bank JSON responses (no network)",
        ),
    ] = None,
) -> None:
    """Re-fetch a seeded sample of public-release cells -> status/spot_check.json."""
    from pathlib import Path

    from imsatlas_etl.pipeline.spot_check import run_spot_check

    try:
        report = run_spot_check(
            n=n,
            seed=seed,
            fixture_responses=Path(fixture_responses) if fixture_responses else None,
        )
    except (FileNotFoundError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"atlas-etl {__version__}: spot-check sampled={report['n_sampled']} "
        f"matches={report['matches']} mismatches={report['mismatches']} "
        f"unreachable={report['unreachable']}",
    )


@app.command("terms-check")
def terms_check_cmd(
    source: Annotated[
        str | None,
        typer.Option("--source", help="Comma-separated source ids, or all"),
    ] = None,
) -> None:
    """Network: store the current terms-page sha256 under status/terms/.

    Never edits rights evidence; ``check`` then sets ``terms_changed``.
    """
    from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES
    from imsatlas_etl.pipeline.terms import write_terms_snapshot

    selected = _parse_sources(source) or list(PIPELINE_SOURCES)
    failed = 0
    for source_id in selected:
        try:
            path = write_terms_snapshot(source_id)
        except SourcesValidationError as exc:
            failed += 1
            typer.secho(str(exc), fg=typer.colors.RED, err=True)
            continue
        typer.echo(f"wrote {path}")
    if failed:
        raise typer.Exit(code=1)


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


@app.command("export-transparency")
def export_transparency_cmd() -> None:
    """Sync status/*.json + release manifest into app/public for §10.4 views."""
    from imsatlas_etl.export_transparency import write_transparency_bundle

    try:
        info = write_transparency_bundle()
    except Exception as exc:  # noqa: BLE001
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"atlas-etl {__version__}: transparency → {info['status_dir']} "
        f"(release v{info['release_version']}, "
        f"{info['n_sources']} sources, {info['n_variables']} variables)",
    )


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


@app.command("export-phase8-goldens")
def export_phase8_goldens_cmd(
    out: Annotated[
        str | None,
        typer.Option(
            "--out",
            help="Output JSON (default: core/fixtures/phase8 + app/public/meta)",
        ),
    ] = None,
) -> None:
    """Export COL HS64 2023 ranking golden for Phase 8 E2E / Vitest."""
    from pathlib import Path

    from imsatlas_etl.export_phase8_goldens import write_phase8_goldens

    try:
        path = write_phase8_goldens(Path(out) if out else None)
    except Exception as exc:  # noqa: BLE001 — surface imsfe failures
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
