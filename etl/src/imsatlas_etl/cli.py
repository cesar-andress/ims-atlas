"""Typer CLI entrypoint for atlas-etl."""

from __future__ import annotations

from typing import Annotated

import typer

from imsatlas_etl import __version__

app = typer.Typer(add_completion=False, no_args_is_help=True, help="IMS Atlas ETL")


@app.callback()
def main() -> None:
    """IMS Atlas ETL commands."""


@app.command("catalog-validate")
def catalog_validate() -> None:
    """Validate catalog/variables.yaml (implemented in Phase 1)."""
    typer.echo(f"atlas-etl {__version__}: catalog-validate scaffold — Phase 1")


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
