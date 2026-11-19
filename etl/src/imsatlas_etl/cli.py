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
from imsatlas_etl.paths import catalog_yaml_path, licenses_md_path
from imsatlas_etl.port_catalog import build_catalog_from_backtest, write_catalog_yaml

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


@app.command("build")
def build() -> None:
    """Build intermediate tables from sources (implemented in later phases)."""
    typer.echo(f"atlas-etl {__version__}: build scaffold — Phase 2+")


@app.command("release")
def release(
    version: Annotated[
        str,
        typer.Option("--version", help="Release version under data/release/"),
    ] = "0.1.0",
) -> None:
    """Write a versioned data release (implemented in Phase 4)."""
    typer.echo(
        f"atlas-etl {__version__}: release scaffold — Phase 4 (v{version})",
    )


if __name__ == "__main__":
    app()
