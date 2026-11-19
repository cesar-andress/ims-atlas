"""Step 5: rule-based QA on curated tables -> status/qa.json + Markdown."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.io_paths import curated_dir, status_root

ISO3_RE = re.compile(r"^[A-Z]{3}$")


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_qa_config(path: Path | None = None) -> dict[str, float]:
    target = path or (repo_root() / "config" / "qa.yaml")
    if not target.is_file():
        return {
            "coverage_drop_block_pct": 25.0,
            "coverage_drop_warn_pct": 10.0,
            "yoy_jump_warn_pct": 50.0,
            "yoy_jump_block_pct": 200.0,
        }
    data = yaml.safe_load(target.read_text(encoding="utf-8")) or {}
    return {k: float(v) for k, v in data.items()}


def _finding(
    *,
    rule: str,
    level: str,
    message: str,
    table: str | None = None,
) -> dict[str, Any]:
    return {"rule": rule, "level": level, "message": message, "table": table}


def _check_duplicates(frame: pd.DataFrame, keys: list[str], table: str) -> list[dict]:
    if frame.empty:
        return []
    dup = frame.duplicated(subset=keys, keep=False)
    n = int(dup.sum())
    if n == 0:
        return []
    return [
        _finding(
            rule="duplicate_keys",
            level="block",
            message=f"{n} duplicate key rows on {keys}",
            table=table,
        ),
    ]


def _check_iso3(frame: pd.DataFrame, cols: list[str], table: str) -> list[dict]:
    findings: list[dict] = []
    for col in cols:
        if col not in frame.columns:
            continue
        bad = frame[~frame[col].astype(str).str.match(ISO3_RE)]
        if len(bad) > 0:
            findings.append(
                _finding(
                    rule="iso3_validity",
                    level="block",
                    message=f"{len(bad)} invalid ISO3 in {col}",
                    table=table,
                ),
            )
    return findings


def _check_yoy(
    frame: pd.DataFrame,
    *,
    value_cols: list[str],
    entity_cols: list[str],
    table: str,
    cfg: dict[str, float],
) -> list[dict]:
    findings: list[dict] = []
    if "year" not in frame.columns or frame.empty:
        return findings
    for col in value_cols:
        if col not in frame.columns:
            continue
        if not pd.api.types.is_numeric_dtype(frame[col]):
            findings.append(
                _finding(
                    rule="unit_mismatch",
                    level="warn",
                    message=f"column {col} is not numeric",
                    table=table,
                ),
            )
            continue
        sorted_frame = frame.sort_values([*entity_cols, "year"])
        for keys, group in sorted_frame.groupby(entity_cols, dropna=False):
            prev = None
            prev_year = None
            for _, row in group.iterrows():
                val = row[col]
                year = int(row["year"])
                if prev is not None and pd.notna(prev) and pd.notna(val) and prev != 0:
                    pct = abs(float(val) - float(prev)) / abs(float(prev)) * 100.0
                    label = keys if isinstance(keys, tuple) else (keys,)
                    if pct >= cfg["yoy_jump_block_pct"]:
                        findings.append(
                            _finding(
                                rule="yoy_jump",
                                level="block",
                                message=(
                                    f"{col} {label} {prev_year}->{year}: "
                                    f"{pct:.1f}% (>= block)"
                                ),
                                table=table,
                            ),
                        )
                    elif pct >= cfg["yoy_jump_warn_pct"]:
                        findings.append(
                            _finding(
                                rule="yoy_jump",
                                level="warn",
                                message=(
                                    f"{col} {label} {prev_year}->{year}: "
                                    f"{pct:.1f}% (>= warn)"
                                ),
                                table=table,
                            ),
                        )
                prev = val
                prev_year = year
    return findings


def _check_coverage_drop(
    current: pd.DataFrame,
    previous: pd.DataFrame | None,
    *,
    table: str,
    cfg: dict[str, float],
) -> list[dict]:
    if previous is None or previous.empty:
        return []
    cur_n = len(current)
    prev_n = len(previous)
    if prev_n == 0:
        return []
    drop_pct = (prev_n - cur_n) / prev_n * 100.0
    if drop_pct >= cfg["coverage_drop_block_pct"]:
        level = "block"
    elif drop_pct >= cfg["coverage_drop_warn_pct"]:
        level = "warn"
    else:
        return []
    return [
        _finding(
            rule="coverage_drop",
            level=level,
            message=f"rows {prev_n}->{cur_n} ({drop_pct:.1f}% drop)",
            table=table,
        ),
    ]


def _check_series_breaks(
    frame: pd.DataFrame,
    breaks: list[int],
    table: str,
) -> list[dict]:
    if not breaks or "year" not in frame.columns or frame.empty:
        return []
    years = set(int(y) for y in frame["year"].dropna().unique())
    findings: list[dict] = []
    for year in breaks:
        if year in years:
            findings.append(
                _finding(
                    rule="series_break_crossed",
                    level="warn",
                    message=f"series break year {year} present in table years",
                    table=table,
                ),
            )
    return findings


def run_qa(
    *,
    root: Path | None = None,
    previous_curated: Path | None = None,
    series_breaks: list[int] | None = None,
) -> dict[str, Any]:
    cfg = load_qa_config()
    cur = curated_dir(root=root)
    findings: list[dict[str, Any]] = []

    country_path = cur / "country_year.parquet"
    bilateral_path = cur / "bilateral_year.parquet"
    if not country_path.is_file() or not bilateral_path.is_file():
        raise FileNotFoundError(
            f"missing curated tables under {cur}; run transform first",
        )

    country = pd.read_parquet(country_path)
    bilateral = pd.read_parquet(bilateral_path)

    prev_country = None
    prev_bilateral = None
    if previous_curated is not None:
        pc = previous_curated / "country_year.parquet"
        pb = previous_curated / "bilateral_year.parquet"
        if pc.is_file():
            prev_country = pd.read_parquet(pc)
        if pb.is_file():
            prev_bilateral = pd.read_parquet(pb)

    findings.extend(_check_duplicates(country, ["iso3", "year"], "country_year"))
    findings.extend(_check_iso3(country, ["iso3"], "country_year"))
    numeric_cols = [
        c
        for c in country.columns
        if c not in {"iso3", "year"} and pd.api.types.is_numeric_dtype(country[c])
    ]
    findings.extend(
        _check_yoy(
            country,
            value_cols=numeric_cols[:8],
            entity_cols=["iso3"],
            table="country_year",
            cfg=cfg,
        ),
    )
    findings.extend(
        _check_coverage_drop(
            country,
            prev_country,
            table="country_year",
            cfg=cfg,
        ),
    )
    findings.extend(
        _check_series_breaks(country, series_breaks or [], "country_year"),
    )

    findings.extend(
        _check_duplicates(
            bilateral,
            ["origin", "destination", "year"],
            "bilateral_year",
        ),
    )
    findings.extend(
        _check_iso3(bilateral, ["origin", "destination"], "bilateral_year"),
    )
    findings.extend(
        _check_coverage_drop(
            bilateral,
            prev_bilateral,
            table="bilateral_year",
            cfg=cfg,
        ),
    )

    blocks = [f for f in findings if f["level"] == "block"]
    warns = [f for f in findings if f["level"] == "warn"]
    report = {
        "generated_at": _now_iso(),
        "status": "fail" if blocks else "pass",
        "n_block": len(blocks),
        "n_warn": len(warns),
        "findings": findings,
        "config": cfg,
    }

    out_dir = status_root(root=root)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "qa.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (out_dir / "qa.md").write_text(render_qa_md(report), encoding="utf-8")
    return report


def render_qa_md(report: dict[str, Any]) -> str:
    lines = [
        "# QA report",
        "",
        f"Generated: {report.get('generated_at')}",
        f"Status: **{report.get('status')}** "
        f"(block={report.get('n_block')}, warn={report.get('n_warn')})",
        "",
        "| Level | Rule | Table | Message |",
        "| --- | --- | --- | --- |",
    ]
    for finding in report.get("findings", []):
        lines.append(
            "| {level} | {rule} | {table} | {msg} |".format(
                level=finding["level"],
                rule=finding["rule"],
                table=finding.get("table") or "—",
                msg=str(finding["message"]).replace("|", "\\|"),
            ),
        )
    if not report.get("findings"):
        lines.append("| — | — | — | no findings |")
    lines.append("")
    return "\n".join(lines)
