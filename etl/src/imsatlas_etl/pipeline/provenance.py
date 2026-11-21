"""Per-cell provenance side table for SPEC §3 release tables.

One provenance row per release cell (country_year / bilateral_year). Rows are
derived from the release tables themselves plus curated metadata, the variable
catalog and the source registry. Nothing is guessed: a variable that cannot be
traced to a registered source and an existing raw artefact raises
``ProvenanceError``.
"""

from __future__ import annotations

import json
import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.connectors.worldbank import api_indicator_code
from imsatlas_etl.iso3 import map_country_name
from imsatlas_etl.pipeline.integrity import sha256_file
from imsatlas_etl.pipeline.io_paths import (
    curated_dir,
    freshness_path,
    raw_source_dir,
)
from imsatlas_etl.pipeline.release_tables import BILATERAL_MAP
from imsatlas_etl.pipeline.variables_build import VARIABLE_SPECS
from imsatlas_etl.sources import sources_by_id

PROVENANCE_PARQUET = "provenance.parquet"
PROVENANCE_JSONL = "provenance.jsonl"
JSONL_MAX_ROWS = 200

COUNTRY_TABLE = "country_year"
BILATERAL_TABLE = "bilateral_year"

PROVENANCE_SCHEMA = pa.schema(
    [
        pa.field("table", pa.string(), nullable=False),
        pa.field("iso3", pa.string()),
        pa.field("iso3_o", pa.string()),
        pa.field("iso3_d", pa.string()),
        pa.field("year", pa.int64(), nullable=False),
        pa.field("variable_id", pa.string(), nullable=False),
        pa.field("source_id", pa.string(), nullable=False),
        pa.field("upstream_code", pa.string()),
        pa.field("upstream_version", pa.string(), nullable=False),
        pa.field("request_url_or_file", pa.string(), nullable=False),
        pa.field("row_key", pa.string(), nullable=False),
        pa.field("raw_sha256", pa.string(), nullable=False),
        pa.field("transform_steps", pa.list_(pa.string()), nullable=False),
        pa.field("flag_imputed", pa.bool_(), nullable=False),
        pa.field("flag_locf", pa.bool_(), nullable=False),
        pa.field("flag_unit_converted", pa.bool_(), nullable=False),
        pa.field("flag_iso3_remap", pa.bool_(), nullable=False),
        pa.field("value", pa.float64()),
    ],
)
PROVENANCE_COLUMNS: list[str] = list(PROVENANCE_SCHEMA.names)

CELL_KEYS: dict[str, list[str]] = {
    COUNTRY_TABLE: ["iso3", "year", "variable_id"],
    BILATERAL_TABLE: ["iso3_o", "iso3_d", "year", "variable_id"],
}
_ENTITY_COLUMNS: dict[str, list[str]] = {
    COUNTRY_TABLE: ["iso3"],
    BILATERAL_TABLE: ["iso3_o", "iso3_d"],
}

# Bilateral release variable -> (source id, raw table file, extra transform steps)
_BILATERAL_SOURCES: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "DIST": ("cepi_gravity", "bilateral.csv", ()),
    "LANG": ("cepi_gravity", "bilateral.csv", ()),
    "FTA": ("cepi_gravity", "bilateral.csv", ()),
    "TARIF": ("wits_trains", "tariffs.csv", ("mean_ahs_over_hs6",)),
}
_BILATERAL_LOADERS = {
    "cepi_gravity": "load_raw_bilateral",
    "wits_trains": "load_raw_tariffs",
}


class ProvenanceError(ValueError):
    """A release cell cannot be traced to a registered source and raw artefact."""


@dataclass(frozen=True)
class VariableOrigin:
    """Everything a provenance row needs that is constant per variable."""

    variable_id: str
    source_id: str
    upstream_code: str | None
    upstream_version: str
    request_url_or_file: str
    raw_sha256: str
    transform_steps: tuple[str, ...]
    flag_unit_converted: bool = False


# --- pure helpers -----------------------------------------------------------


def empty_provenance() -> pd.DataFrame:
    """Zero-row frame with the provenance columns."""
    return pd.DataFrame(
        {name: pd.Series(dtype="object") for name in PROVENANCE_COLUMNS},
    )


def iso3_remap_pairs(frame: pd.DataFrame) -> set[tuple[str, int]]:
    """
    ``(iso3, year)`` pairs whose ISO3 came from the explicit country-name map.

    Mirrors ``iso3.map_country_column``: a row keeps its own ISO3 when it is a
    3-letter string, otherwise the name map supplies it (a remap).
    """
    out: set[tuple[str, int]] = set()
    if "country_name" not in frame.columns:
        return out
    for _idx, row in frame.iterrows():
        own = row.get("iso3")
        if isinstance(own, str) and len(own.strip()) == 3:
            continue
        iso = map_country_name(str(row.get("country_name")))
        if iso is not None:
            out.add((iso, int(row["year"])))
    return out


def make_row_keys(
    cells: pd.DataFrame,
    table: str,
    upstream_code: Mapping[str, str | None],
) -> pd.Series:
    """Natural raw-row key: entity ids | year | upstream code (when the raw has one)."""
    parts = [*_ENTITY_COLUMNS[table], "year"]
    keys: list[str] = []
    for row in cells.itertuples(index=False):
        values = [str(getattr(row, col)) for col in parts]
        code = upstream_code.get(str(row.variable_id))
        if code:
            values.append(code)
        keys.append("|".join(values))
    return pd.Series(keys, index=cells.index, dtype="object")


def build_provenance_frame(
    cells: pd.DataFrame,
    table: str,
    origins: Mapping[str, VariableOrigin],
    *,
    remapped: Mapping[str, set[tuple[str, int]]] | None = None,
) -> pd.DataFrame:
    """
    One provenance row per release cell, in cell order.

    ``cells`` must carry the SPEC §3 long-table columns. A variable without an
    origin raises ``ProvenanceError`` (no silent drop, no invented source).
    """
    if table not in CELL_KEYS:
        raise ProvenanceError(f"unknown table {table!r}")
    if cells.empty:
        return empty_provenance()
    unknown = sorted(set(cells["variable_id"].astype(str)) - set(origins))
    if unknown:
        raise ProvenanceError(f"{table}: no provenance origin for variables {unknown}")
    if cells.duplicated(CELL_KEYS[table]).any():
        raise ProvenanceError(f"{table}: duplicate cell keys; provenance is 1:1")
    codes = {vid: origin.upstream_code for vid, origin in origins.items()}
    remap = remapped or {}
    rows: list[dict[str, Any]] = []
    keys = make_row_keys(cells, table, codes)
    for key, row in zip(keys, cells.itertuples(index=False), strict=True):
        vid = str(row.variable_id)
        origin = origins[vid]
        year = int(row.year)
        entity = {"iso3": None, "iso3_o": None, "iso3_d": None}
        for col in _ENTITY_COLUMNS[table]:
            entity[col] = str(getattr(row, col))
        value = float(row.value) if not pd.isna(row.value) else None
        rows.append(
            {
                "table": table,
                **entity,
                "year": year,
                "variable_id": vid,
                "source_id": origin.source_id,
                "upstream_code": origin.upstream_code,
                "upstream_version": origin.upstream_version,
                "request_url_or_file": origin.request_url_or_file,
                "row_key": key,
                "raw_sha256": origin.raw_sha256,
                "transform_steps": list(origin.transform_steps),
                "flag_imputed": bool(row.flag_imputed),
                "flag_locf": bool(row.flag_locf),
                "flag_unit_converted": origin.flag_unit_converted,
                "flag_iso3_remap": (entity["iso3"], year) in remap.get(vid, set()),
                "value": value,
            },
        )
    return pd.DataFrame(rows, columns=PROVENANCE_COLUMNS)


def provenance_join_problems(
    cells_by_table: Mapping[str, pd.DataFrame],
    provenance: pd.DataFrame,
) -> list[str]:
    """Cells without provenance, provenance without cells, duplicate rows."""
    problems: list[str] = []
    expected_tables = set(cells_by_table)
    if not provenance.empty:
        extra_tables = set(provenance["table"].astype(str)) - expected_tables
        if extra_tables:
            problems.append(
                f"provenance rows for unknown tables: {sorted(extra_tables)}",
            )
    for table, cells in cells_by_table.items():
        keys = CELL_KEYS[table]
        sub = (
            provenance[provenance["table"] == table]
            if not provenance.empty
            else provenance
        )
        if sub.duplicated(keys).any():
            problems.append(f"{table}: duplicate provenance rows per cell")
        cell_keys = {tuple(r) for r in cells[keys].itertuples(index=False, name=None)}
        prov_keys = {tuple(r) for r in sub[keys].itertuples(index=False, name=None)}
        n_missing = len(cell_keys - prov_keys)
        n_orphan = len(prov_keys - cell_keys)
        if n_missing:
            problems.append(f"{table}: {n_missing} cells without provenance")
        if n_orphan:
            problems.append(f"{table}: {n_orphan} orphan provenance rows")
    return problems


# --- origin resolution (reads curated meta, catalog, source registry) -------


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _raw_artefact(path: Path) -> tuple[str, str]:
    """(request url or file, sha256) of a raw table via its sidecar meta."""
    if not path.is_file():
        raise ProvenanceError(f"raw artefact missing: {path}")
    meta_path = path.with_suffix(path.suffix + ".meta.json")
    meta: dict[str, Any] = _read_json(meta_path) if meta_path.is_file() else {}
    digest = str(meta.get("sha256") or sha256_file(path))
    url = meta.get("url")
    return (str(url) if url else path.name), digest


def _check_registered(variable_id: str, source_id: str) -> None:
    variables = {str(v["id"]): v for v in load_catalog().get("variables", [])}
    variable = variables.get(variable_id)
    if variable is None:
        raise ProvenanceError(f"variable {variable_id!r} not in catalog")
    if source_id not in (variable.get("source_ids") or []):
        raise ProvenanceError(
            f"variable {variable_id}: source {source_id!r} not in catalog source_ids",
        )
    if source_id not in sources_by_id():
        raise ProvenanceError(f"source {source_id!r} not in sources registry")


def resolve_country_origins(
    variable_ids: Iterable[str],
    *,
    root: Path | None = None,
) -> tuple[dict[str, VariableOrigin], dict[str, set[tuple[str, int]]]]:
    ids = sorted(set(variable_ids))
    if not ids:
        return {}, {}
    meta_path = curated_dir(root=root) / "variables_country_year.meta.json"
    if not meta_path.is_file():
        raise ProvenanceError(f"curated meta missing: {meta_path}")
    variables_meta = _read_json(meta_path).get("variables", {})
    origins: dict[str, VariableOrigin] = {}
    remapped: dict[str, set[tuple[str, int]]] = {}
    for vid in ids:
        spec = VARIABLE_SPECS.get(vid)
        info = variables_meta.get(vid)
        if spec is None or not info or info.get("status") != "ok":
            raise ProvenanceError(f"no curated provenance metadata for {vid}")
        source_id = str(spec["source_id"])
        version = str(info.get("version") or "")
        if not version or version.lower() == "none":
            raise ProvenanceError(f"no curated provenance version for {vid}")
        _check_registered(vid, source_id)
        kind = str(spec.get("kind") or "")
        is_wb = kind in {"wb_indicator", "derived_mean"}
        raw_dir = raw_source_dir(source_id, version, root=root)
        raw = raw_dir / ("indicators.csv" if is_wb else "values.csv")
        url, digest = _raw_artefact(raw)
        code = spec.get("code")
        if kind == "derived_mean":
            steps = (
                "load_raw_indicators",
                "select_wgi_estimates",
                "mean_gov",
            )
            code = None
        elif is_wb and code:
            url = url.replace("{code}", api_indicator_code(code))
            steps = ("load_raw_indicators", "select_indicator")
        else:
            steps = ("load_raw_values",)
            remapped[vid] = iso3_remap_pairs(pd.read_csv(raw))
            if remapped[vid]:
                steps = (*steps, "map_country_name_to_iso3")
        origins[vid] = VariableOrigin(
            variable_id=vid,
            source_id=source_id,
            upstream_code=code,
            upstream_version=version,
            request_url_or_file=url,
            raw_sha256=digest,
            transform_steps=(
                *steps,
                "merge_variables_country_year",
                "melt_release_long",
            ),
        )
    return origins, remapped


def _freshness_versions(root: Path | None) -> dict[str, str]:
    path = freshness_path(root=root)
    if not path.is_file():
        raise ProvenanceError(f"freshness.json missing: {path}")
    payload = _read_json(path)
    return {str(r["source"]): str(r["upstream_version"]) for r in payload["sources"]}


def resolve_bilateral_origins(
    variable_ids: Iterable[str],
    *,
    root: Path | None = None,
) -> dict[str, VariableOrigin]:
    ids = sorted(set(variable_ids))
    if not ids:
        return {}
    versions = _freshness_versions(root)
    column_by_var = {vid: col for col, vid in BILATERAL_MAP.items()}
    origins: dict[str, VariableOrigin] = {}
    for vid in ids:
        spec = _BILATERAL_SOURCES.get(vid)
        column = column_by_var.get(vid)
        if spec is None or column is None:
            raise ProvenanceError(f"no bilateral provenance mapping for {vid}")
        source_id, filename, extra = spec
        version = versions.get(source_id)
        if version is None:
            raise ProvenanceError(f"{source_id} not in freshness.json")
        _check_registered(vid, source_id)
        url, digest = _raw_artefact(
            raw_source_dir(source_id, version, root=root) / filename,
        )
        origins[vid] = VariableOrigin(
            variable_id=vid,
            source_id=source_id,
            upstream_code=column if source_id == "cepi_gravity" else "ahs",
            upstream_version=version,
            request_url_or_file=url,
            raw_sha256=digest,
            transform_steps=(
                _BILATERAL_LOADERS[source_id],
                *extra,
                "merge_bilateral_year",
                "rename_release_long",
            ),
        )
    return origins


# --- release writer ---------------------------------------------------------


def _read_cells(release_dir: Path, table: str) -> pd.DataFrame:
    path = release_dir / f"{table}.parquet"
    if path.is_file():
        return pd.read_parquet(path)
    # Partitioned layout (e.g. bilateral_year/variable_id=*/part.parquet).
    parts_dir = release_dir / table
    if parts_dir.is_dir():
        parts = sorted(parts_dir.glob("variable_id=*/part.parquet"))
        if parts:
            return pd.concat([pd.read_parquet(p) for p in parts], ignore_index=True)
    raise ProvenanceError(f"release table missing: {path}")


def write_provenance_parquet(frame: pd.DataFrame, path: Path) -> None:
    """Write with the fixed schema (also for zero rows); no pandas metadata."""
    table = pa.Table.from_pandas(
        frame[PROVENANCE_COLUMNS],
        schema=PROVENANCE_SCHEMA,
        preserve_index=False,
    )
    pq.write_table(table.replace_schema_metadata(None), path)


def write_provenance_jsonl(frame: pd.DataFrame, path: Path) -> None:
    lines: list[str] = []
    for record in frame.to_dict(orient="records"):
        clean = {
            k: (None if isinstance(v, float) and math.isnan(v) else v)
            for k, v in record.items()
        }
        clean["transform_steps"] = list(clean["transform_steps"])
        lines.append(json.dumps(clean, sort_keys=True))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_release_provenance(release_dir: Path) -> pd.DataFrame:
    """Load partitioned provenance (or legacy single-file) from a release tree."""
    parts = sorted(
        (release_dir / "provenance").glob("variable_id=*/year=*/part.parquet"),
    )
    if not parts:
        legacy = release_dir / PROVENANCE_PARQUET
        if legacy.is_file():
            return pd.read_parquet(legacy)
        return empty_provenance()
    return pd.concat([pd.read_parquet(p) for p in parts], ignore_index=True)


def build_provenance_for_release(
    release_dir: Path,
    *,
    root: Path | None = None,
) -> dict[str, Any]:
    """
    Write provenance partitioned by variable_id × year (SPEC ≤5 MB per file).

    Also writes a tiny ``provenance.jsonl`` sample for releases with few cells.
    Legacy single ``provenance.parquet`` is removed when partitions are written.
    """
    country = _read_cells(release_dir, COUNTRY_TABLE)
    bilateral = _read_cells(release_dir, BILATERAL_TABLE)
    c_origins, remapped = resolve_country_origins(
        country["variable_id"].astype(str).unique(),
        root=root,
    )
    b_origins = resolve_bilateral_origins(
        bilateral["variable_id"].astype(str).unique(),
        root=root,
    )
    parts = [
        build_provenance_frame(country, COUNTRY_TABLE, c_origins, remapped=remapped),
        build_provenance_frame(bilateral, BILATERAL_TABLE, b_origins),
    ]
    parts = [p for p in parts if not p.empty]
    frame = pd.concat(parts, ignore_index=True) if parts else empty_provenance()
    problems = provenance_join_problems(
        {COUNTRY_TABLE: country, BILATERAL_TABLE: bilateral},
        frame,
    )
    if problems:
        raise ProvenanceError("; ".join(problems))

    legacy = release_dir / PROVENANCE_PARQUET
    if legacy.is_file():
        legacy.unlink()
    out_dir = release_dir / "provenance"
    if out_dir.is_dir():
        for old in out_dir.rglob("part.parquet"):
            old.unlink()
    n_parts = 0
    if frame.empty:
        empty_path = out_dir / "variable_id=_empty" / "year=0" / "part.parquet"
        empty_path.parent.mkdir(parents=True, exist_ok=True)
        write_provenance_parquet(frame, empty_path)
        n_parts = 1
    else:
        for (vid, year), chunk in frame.groupby(["variable_id", "year"], sort=True):
            path = out_dir / f"variable_id={vid}" / f"year={int(year)}" / "part.parquet"
            path.parent.mkdir(parents=True, exist_ok=True)
            write_provenance_parquet(chunk.reset_index(drop=True), path)
            n_parts += 1

    jsonl_path = release_dir / PROVENANCE_JSONL
    wrote_jsonl = 0 < len(frame) <= JSONL_MAX_ROWS
    if wrote_jsonl:
        write_provenance_jsonl(frame, jsonl_path)
    elif jsonl_path.is_file():
        jsonl_path.unlink()
    return {
        "path": str(out_dir),
        "provenance_rows": int(len(frame)),
        "provenance_parts": n_parts,
        "provenance_jsonl": wrote_jsonl,
    }
