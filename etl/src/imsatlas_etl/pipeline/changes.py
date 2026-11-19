"""Change detection between two ingests of the same source.

``compare_source_tables`` is pure (no I/O, deterministic). The helpers below it
load raw tables, write ``status/changes/<run_id>.json``, append
``status/history.jsonl`` and patch per-variable freshness fields.
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.pipeline.io_paths import ingested_versions, status_root

KEY_CANDIDATES = (
    "iso3",
    "year",
    "indicator",
    "origin",
    "destination",
    "exporter",
    "importer",
    "hs6",
)
GEO_COLUMNS = ("iso3", "origin", "destination", "exporter", "importer")
DEFAULT_TOP_N = 10
MAX_DIFF_ROWS = 5_000_000


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def infer_keys(prev: pd.DataFrame, nxt: pd.DataFrame) -> list[str]:
    keys = [c for c in KEY_CANDIDATES if c in prev.columns and c in nxt.columns]
    if not keys:
        raise ValueError("no shared key columns between tables")
    return keys


def _native(value: Any) -> Any:
    """Plain Python scalar for JSON (numpy ints/floats -> int/float)."""
    return value.item() if hasattr(value, "item") else value


def _distinct(frame: pd.DataFrame, column: str) -> set[Any]:
    return {_native(v) for v in frame[column].dropna().unique()}


def _countries(frame: pd.DataFrame, keys: list[str]) -> set[str]:
    out: set[str] = set()
    for col in GEO_COLUMNS:
        if col in keys and col in frame.columns:
            out |= {str(v) for v in _distinct(frame, col)}
    return out


def _is_numeric_like(series: pd.Series) -> bool:
    """Numeric dtype, or object dtype whose non-null entries are all numbers."""
    if pd.api.types.is_numeric_dtype(series):
        return True
    coerced = pd.to_numeric(series, errors="coerce")
    return bool(coerced.notna().sum() == series.notna().sum())


def _dedupe(frame: pd.DataFrame, keys: list[str]) -> tuple[pd.DataFrame, int]:
    deduped = frame.drop_duplicates(keys, keep="first")
    return deduped, len(frame) - len(deduped)


def compare_source_tables(
    prev: pd.DataFrame,
    nxt: pd.DataFrame,
    *,
    keys: list[str] | None = None,
    prev_version: str | None = None,
    next_version: str | None = None,
    top_n: int = DEFAULT_TOP_N,
) -> dict[str, Any]:
    """Diff two long raw tables on ``keys``; every count is explicit.

    A *cell* is one (key, value column) pair with a non-null value. ``new``
    cells are non-null only in ``nxt``; ``removed`` cells only in ``prev``;
    ``revised`` cells are non-null in both with different values.
    """
    key_cols = list(keys) if keys else infer_keys(prev, nxt)
    p, dup_prev = _dedupe(prev, key_cols)
    n, dup_next = _dedupe(nxt, key_cols)
    common = [c for c in p.columns if c in n.columns and c not in key_cols]
    value_cols = [
        c for c in common if _is_numeric_like(p[c]) and _is_numeric_like(n[c])
    ]
    p, n = p.copy(), n.copy()
    for col in value_cols:
        p[col] = pd.to_numeric(p[col], errors="coerce")
        n[col] = pd.to_numeric(n[col], errors="coerce")

    result: dict[str, Any] = {
        "keys": key_cols,
        "value_columns": value_cols,
        "version": {
            "previous": prev_version,
            "next": next_version,
            "changed": prev_version != next_version,
        },
        "columns_added": sorted(set(nxt.columns) - set(prev.columns)),
        "columns_removed": sorted(set(prev.columns) - set(nxt.columns)),
        "n_rows_previous": len(prev),
        "n_rows_next": len(nxt),
        "duplicate_keys_previous": dup_prev,
        "duplicate_keys_next": dup_next,
    }
    if "year" in key_cols:
        py, ny = _distinct(p, "year"), _distinct(n, "year")
        result["new_years"] = sorted(int(y) for y in ny - py)
        result["removed_years"] = sorted(int(y) for y in py - ny)
    else:
        result["new_years"], result["removed_years"] = [], []
    pc, nc = _countries(p, key_cols), _countries(n, key_cols)
    result["new_countries"] = sorted(nc - pc)
    result["removed_countries"] = sorted(pc - nc)

    merged = p[key_cols + value_cols].merge(
        n[key_cols + value_cols],
        on=key_cols,
        how="outer",
        suffixes=("__prev", "__next"),
    )
    new_cells = removed_cells = 0
    new_by_group: dict[str, int] = {}
    revised: list[dict[str, Any]] = []
    for col in value_cols:
        before, after = merged[f"{col}__prev"], merged[f"{col}__next"]
        is_new = before.isna() & after.notna()
        new_cells += int(is_new.sum())
        removed_cells += int((before.notna() & after.isna()).sum())
        if "indicator" in key_cols and is_new.any():
            for name, count in merged.loc[is_new, "indicator"].value_counts().items():
                new_by_group[str(name)] = new_by_group.get(str(name), 0) + int(count)
        both = before.notna() & after.notna() & (before != after)
        for idx in merged.index[both]:
            row = merged.loc[idx]
            rec = {k: _native(row[k]) for k in key_cols}
            rec["column"] = col
            rec["previous"] = float(row[f"{col}__prev"])
            rec["next"] = float(row[f"{col}__next"])
            rec["abs_change"] = abs(rec["next"] - rec["previous"])
            revised.append(rec)
    revised.sort(
        key=lambda r: (-r["abs_change"], *(str(r[k]) for k in key_cols), r["column"]),
    )
    result["new_cells"] = new_cells
    result["removed_cells"] = removed_cells
    result["new_cells_by_indicator"] = dict(sorted(new_by_group.items()))
    result["revised"] = {
        "count": len(revised),
        "max_abs_change": revised[0]["abs_change"] if revised else 0.0,
        "top": revised[:top_n],
    }
    return result


def has_changes(diff: dict[str, Any]) -> bool:
    return bool(
        diff.get("new_years")
        or diff.get("removed_years")
        or diff.get("new_countries")
        or diff.get("removed_countries")
        or diff.get("new_cells")
        or diff.get("removed_cells")
        or diff.get("revised", {}).get("count")
        or diff.get("columns_added")
        or diff.get("columns_removed"),
    )


def readable_source_summary(source_id: str, diff: dict[str, Any]) -> str:
    """One plain-language line for the transparency updates UI (no invented facts)."""
    status = str(diff.get("status") or "")
    # Pure ``compare_source_tables`` has no status field; treat as compared.
    if not status and ("revised" in diff or "new_years" in diff or "new_cells" in diff):
        status = "compared"
    if not status:
        status = "unknown"
    if status == "first_ingest":
        return f"{source_id}: first ingest ({diff.get('n_rows_next', 0)} rows)"
    if status == "skipped_existing":
        return f"{source_id}: unchanged (already on disk)"
    if status == "skipped_too_large":
        return f"{source_id}: diff skipped (table too large to compare in-process)"
    if status == "error":
        return f"{source_id}: diff error ({diff.get('error')})"
    if status != "compared":
        return f"{source_id}: {status}"
    parts: list[str] = [source_id]
    new_years = diff.get("new_years") or []
    if new_years:
        n_c = len(diff.get("new_countries") or [])
        year_bit = ", ".join(str(y) for y in new_years[:5])
        if len(new_years) > 5:
            year_bit += ", …"
        if n_c:
            parts.append(f"+{year_bit} for {n_c} countries")
        else:
            parts.append(f"+{year_bit}")
    revised = diff.get("revised") or {}
    rev_n = int(revised.get("count") or 0)
    if rev_n:
        parts.append(f"{rev_n} revised values")
        top = revised.get("top") or []
        if top:
            t0 = top[0]
            label = t0.get("indicator") or t0.get("column") or "?"
            iso = t0.get("iso3") or t0.get("destination") or t0.get("importer") or "?"
            prev_v, next_v = t0.get("previous"), t0.get("next")
            if prev_v not in (None, 0) and next_v is not None:
                pct = 100.0 * (float(next_v) - float(prev_v)) / abs(float(prev_v))
                parts.append(f"largest: {label} {iso} {pct:+.1f} %")
            else:
                parts.append(f"largest: {label} {iso}")
    new_cells = int(diff.get("new_cells") or 0)
    if new_cells and not new_years:
        parts.append(f"{new_cells} new cells")
    removed = diff.get("removed_countries") or []
    if removed:
        parts.append(f"{len(removed)} countries removed")
    if (diff.get("version") or {}).get("changed"):
        prev_v = diff["version"].get("previous")
        next_v = diff["version"].get("next")
        parts.append(f"version {prev_v} → {next_v}")
    if len(parts) == 1:
        parts.append("no material cell changes")
    return "; ".join(parts)


# --- I/O layer -----------------------------------------------------------


def previous_raw_version(
    source_id: str,
    version: str,
    *,
    mode: str | None = None,
    root: Path | None = None,
) -> str | None:
    """Most recently written ingested raw version other than ``version``."""
    others = [
        v for v in ingested_versions(source_id, mode=mode, root=root) if v != version
    ]
    return others[-1] if others else None


def diff_raw_source(
    source_id: str,
    prev_version: str | None,
    next_version: str,
    *,
    root: Path | None = None,
) -> dict[str, Any]:
    """Load both raw versions and diff them (or report first ingest / too large)."""
    from imsatlas_etl.pipeline.validate import load_raw_table

    nxt = load_raw_table(source_id, next_version, root=root)
    if prev_version is None:
        return {
            "status": "first_ingest",
            "version": {"previous": None, "next": next_version, "changed": True},
            "n_rows_next": int(len(nxt)),
        }
    prev = load_raw_table(source_id, prev_version, root=root)
    if max(len(prev), len(nxt)) > MAX_DIFF_ROWS:
        return {
            "status": "skipped_too_large",
            "version": {
                "previous": prev_version,
                "next": next_version,
                "changed": prev_version != next_version,
            },
            "n_rows_previous": int(len(prev)),
            "n_rows_next": int(len(nxt)),
        }
    diff = compare_source_tables(
        prev,
        nxt,
        prev_version=prev_version,
        next_version=next_version,
    )
    return {"status": "compared", **diff}


def changes_dir(*, root: Path | None = None) -> Path:
    return status_root(root) / "changes"


def history_path(*, root: Path | None = None) -> Path:
    return status_root(root) / "history.jsonl"


def record_changes(
    run_id: str,
    *,
    mode: str,
    results: list[dict[str, Any]],
    root: Path | None = None,
) -> dict[str, Any]:
    """Diff each extracted source against its previous raw version; write JSON."""
    sources: dict[str, Any] = {}
    for res in results:
        sid, version = str(res["source"]), str(res["version"])
        if res.get("skipped"):
            sources[sid] = {
                "status": "skipped_existing",
                "version": {"previous": version, "next": version, "changed": False},
            }
            continue
        prev = previous_raw_version(sid, version, mode=mode, root=root)
        try:
            sources[sid] = diff_raw_source(sid, prev, version, root=root)
        except Exception as exc:  # noqa: BLE001 - report, never hide
            sources[sid] = {"status": "error", "error": str(exc), "version": version}
    payload = {
        "run_id": run_id,
        "generated_at": _now_iso(),
        "mode": mode,
        "is_fixture": mode == "fixture",
        "sources": sources,
    }
    out = changes_dir(root=root)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{run_id}.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return payload


def history_entry(
    log: dict[str, Any], changes: dict[str, Any] | None
) -> dict[str, Any]:
    """One compact summary line per run for status/history.jsonl."""
    compared = [
        s
        for s in ((changes or {}).get("sources") or {}).values()
        if s.get("status") == "compared"
    ]
    extract = (log.get("steps") or {}).get("extract") or {}
    results = extract.get("results") or []
    return {
        "run_id": log["run_id"],
        "mode": log.get("mode"),
        "status": log.get("status"),
        "started_at": log.get("started_at"),
        "ended_at": log.get("ended_at"),
        "sources": list(log.get("sources") or []),
        "versions": {r["source"]: r["version"] for r in results},
        "ingested": sorted(r["source"] for r in results if not r.get("skipped")),
        "n_new_cells": sum(int(s.get("new_cells", 0)) for s in compared),
        "n_revised_cells": sum(int(s["revised"]["count"]) for s in compared),
        "qa_status": ((log.get("steps") or {}).get("qa") or {}).get("report_status"),
    }


def append_history(entry: dict[str, Any], *, root: Path | None = None) -> Path:
    path = history_path(root=root)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, sort_keys=True) + "\n")
    return path


def read_history(*, root: Path | None = None) -> list[dict[str, Any]]:
    path = history_path(root=root)
    if not path.is_file():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


# --- per-variable status fields -----------------------------------------

_WB_CODE = re.compile(r"^[A-Z]{2}(?:\.[A-Z0-9]+)+$")


def _latest_source_diffs(*, root: Path | None) -> dict[str, dict[str, Any]]:
    """source id -> newest diff with status ``compared`` across all runs."""
    directory = changes_dir(root=root)
    out: dict[str, dict[str, Any]] = {}
    for path in (
        sorted(directory.glob("*.json"), reverse=True) if directory.is_dir() else []
    ):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for sid, diff in (payload.get("sources") or {}).items():
            if diff.get("status") == "compared" and sid not in out:
                out[sid] = diff
    return out


def _variable_new_cells(
    variable: dict[str, Any],
    diffs: dict[str, dict[str, Any]],
) -> int | None:
    if not diffs:
        return None
    codes = [
        c.strip()
        for c in re.split(r"[,/]", str(variable.get("code") or ""))
        if _WB_CODE.match(c.strip())
    ]
    if not codes:
        return None
    total = 0
    found = False
    for sid in variable.get("source_ids") or []:
        src = diffs.get(sid) or {}
        if "indicator" not in src.get("keys", []):
            continue
        by_ind = src.get("new_cells_by_indicator") or {}
        found = True
        total += sum(int(by_ind.get(code, 0)) for code in codes)
    return total if found else None


def variables_status_fields(
    variables: list[dict[str, Any]],
    freshness: dict[str, Any],
    *,
    root: Path | None = None,
) -> dict[str, dict[str, Any]]:
    """variable id -> last_checked/last_upstream_change/last_ingested/new cells."""
    fresh = {
        str(r["source"]): r
        for r in freshness.get("sources", [])
        if isinstance(r, dict) and "source" in r
    }
    last_ingested: dict[str, str] = {}
    for entry in read_history(root=root):
        for sid in entry.get("ingested") or []:
            last_ingested[sid] = str(entry.get("ended_at"))
    diffs = _latest_source_diffs(root=root)
    out: dict[str, dict[str, Any]] = {}
    for var in variables:
        sids = [str(s) for s in var.get("source_ids") or []]
        checked = [
            fresh[s]["checked_at"] for s in sids if fresh.get(s, {}).get("checked_at")
        ]
        upstream = [
            fresh[s]["upstream_changed_at"]
            for s in sids
            if fresh.get(s, {}).get("upstream_changed_at")
        ]
        ingested = [last_ingested[s] for s in sids if s in last_ingested]
        out[str(var["id"])] = {
            "last_checked": max(checked) if checked else None,
            "last_upstream_change": max(upstream) if upstream else None,
            "last_ingested": max(ingested) if ingested else None,
            "new_cells_since_previous": _variable_new_cells(var, diffs),
        }
    return out


def update_variables_status(*, root: Path | None = None) -> Path | None:
    """Patch status/variables.json in place when it exists; else do nothing."""
    from imsatlas_etl.pipeline.io_paths import freshness_path

    path = status_root(root) / "variables.json"
    fpath = freshness_path(root=root)
    if not (path.is_file() and fpath.is_file()):
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    freshness = json.loads(fpath.read_text(encoding="utf-8"))
    fields = variables_status_fields(payload.get("variables", []), freshness, root=root)
    for row in payload.get("variables", []):
        row.update(fields.get(str(row["id"]), {}))
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path
