"""Phase A1: read an IMSFE/IMSFEM workbook and reproduce final scores.

Discovers structure by headers and formulas (not fixed cell addresses).
Respondent personal names never leave this module — only ``Expert 1..n``.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

CODE_RE = re.compile(r"\(([A-Z]{3,5})\)\s*$")
EXPORTER_RE = re.compile(
    r"sum\s+of\s+exporter\s+country\s*:\s*(.+)$",
    re.IGNORECASE,
)
OVERALL_RE = re.compile(r"overall\s+score\s*-\s*total", re.IGNORECASE)


@dataclass
class WorkbookImportReport:
    path: str
    path_label: str
    origin: str | None
    hs_code: str | None
    scale: float | None
    n_criteria: int
    n_variables: int
    n_experts: int
    expert_labels: list[str]
    criterion_weights: dict[str, float]
    variable_weights: dict[str, float]
    variable_direction: dict[str, str]  # DMP | IMP | UNKNOWN
    final_scores: dict[str, float]
    preselected_countries: list[str]
    assumptions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Never expose a filesystem path that may contain author surnames.
        d.pop("path", None)
        return d


def _code_from_label(label: str) -> str | None:
    m = CODE_RE.search(label.strip())
    return m.group(1) if m else None


def _is_country_name(val: object) -> bool:
    if not isinstance(val, str):
        return False
    s = val.strip()
    if len(s) < 2:
        return False
    low = s.lower()
    if low in {
        "countries",
        "country",
        "n.",
        "factor",
        "pre-selection",
        "total average",
        "n. respondents",
    }:
        return False
    if s.startswith("http") or "respondent" in low or "professor" in low:
        return False
    if "empresarios" in low or "professional" in low:
        return False
    return any(c.isalpha() for c in s)


def _sheet(wb: Any, name: str) -> Worksheet:
    if name not in wb.sheetnames:
        raise ValueError(f"missing sheet {name!r}; have {wb.sheetnames}")
    return wb[name]


def _path_label(path: Path) -> str:
    """Safe label without author surnames from typical Jose filenames."""
    name = path.name.lower()
    if "olive" in name or "15.09" in name or "imsfem" in name:
        return "IMSFEM olive-oil workbook"
    if "footwear" in name or "shoes" in name or "imsfe" in name:
        return "IMSFE footwear workbook"
    return "IMSFE workbook"


def _find_origin(ws: Worksheet) -> str | None:
    for row in ws.iter_rows(min_row=1, max_row=10, max_col=50, values_only=True):
        for cell in row:
            if not isinstance(cell, str):
                continue
            m = EXPORTER_RE.search(cell.strip())
            if m:
                return m.group(1).strip()
    return None


def _find_hs(ws: Worksheet) -> str | None:
    # Prefer numeric under "Customs Code"
    for r in range(1, 8):
        for c in range(1, 8):
            label = ws.cell(r, c).value
            if isinstance(label, str) and "customs" in label.lower():
                below = ws.cell(r + 1, c).value
                if isinstance(below, (int, float)):
                    raw = str(int(below)) if float(below).is_integer() else str(below)
                    if len(raw) == 4:
                        return f"{raw[:2]}.{raw[2:]}"
                    return raw
                if isinstance(below, str) and re.fullmatch(
                    r"\d{2}(\.\d{2})?",
                    below.strip(),
                ):
                    return below.strip()
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=6, values_only=True):
        for cell in row:
            if isinstance(cell, str) and "trademap" in cell.lower():
                m = re.search(r"%7c(\d{2,6})%7c", cell, re.IGNORECASE)
                if m:
                    raw = m.group(1)
                    if len(raw) == 4:
                        return f"{raw[:2]}.{raw[2:]}"
                    return raw
            if isinstance(cell, str) and re.fullmatch(r"\d{2}(\.\d{2})?", cell.strip()):
                return cell.strip()
    return None


def _find_scale(ws: Worksheet) -> float | None:
    for r in range(1, 6):
        for c in range(1, 4):
            cell = ws.cell(r, c).value
            if isinstance(cell, str) and "puntaje" in cell.lower():
                m = re.search(r"(\d+(?:\.\d+)?)", cell)
                if m:
                    return float(m.group(1))
            if isinstance(cell, (int, float)) and float(cell) in {5.0, 10.0}:
                return float(cell)
    return 10.0


def _read_weights(
    ws: Worksheet,
) -> tuple[dict[str, float], dict[str, float], list[str]]:
    criterion_weights: dict[str, float] = {}
    variable_weights: dict[str, float] = {}
    assumptions: list[str] = []
    for r in range(1, ws.max_row + 1):
        factor_label = ws.cell(r, 3).value
        factor_w = ws.cell(r, 4).value
        var_label = ws.cell(r, 6).value
        var_w = ws.cell(r, 7).value
        if isinstance(factor_label, str) and isinstance(factor_w, (int, float)):
            code = _code_from_label(factor_label)
            if code:
                criterion_weights[code] = float(factor_w)
        if isinstance(var_label, str) and isinstance(var_w, (int, float)):
            code = _code_from_label(var_label)
            if code:
                variable_weights[code] = float(var_w)
    if criterion_weights:
        s = sum(criterion_weights.values())
        if abs(s - 1.0) > 1e-6:
            assumptions.append(
                f"criterion weights sum to {s:.6f}; stored as in workbook "
                "(renormalise at scoring time if needed)",
            )
    return criterion_weights, variable_weights, assumptions


def _count_experts_anonymized(ws: Worksheet) -> tuple[int, list[str], list[str]]:
    """Count first respondent block only; never retain personal names."""
    warnings: list[str] = []
    n = 0
    aggregated_label = False
    # Find first "N. Respondents" then count until "Total average"
    start = None
    for r in range(1, min(ws.max_row, 80) + 1):
        b = ws.cell(r, 2).value
        if isinstance(b, str) and "n. respondents" in b.lower():
            start = r + 1
            break
    if start is None:
        return 0, [], ["could not locate respondent block"]

    for r in range(start, min(start + 40, ws.max_row + 1)):
        b = ws.cell(r, 2).value
        score = ws.cell(r, 3).value
        if isinstance(b, str) and "total average" in b.lower():
            break
        if isinstance(b, str) and "empresarios" in b.lower():
            aggregated_label = True
        idx = ws.cell(r, 1).value
        if isinstance(idx, (int, float)) and isinstance(score, (int, float)):
            n += 1
            # Intentionally ignore column B content (may be a personal name).
        elif (
            isinstance(b, str)
            and "respondent" in b.lower()
            and isinstance(
                score,
                (int, float),
            )
        ):
            n += 1

    # Sheet title row "14 Empresarios…" with a single Respondent 1 row
    title = ws.cell(2, 2).value
    if isinstance(title, str) and re.search(r"\d+\s+empresarios", title, re.I):
        aggregated_label = True
        m = re.search(r"(\d+)", title)
        if m and n == 1:
            warnings.append(
                f"respuesta agregada: etiqueta «{m.group(1)} respondents», "
                "1 fila; dispersión desconocida",
            )

    labels = [f"Expert {i}" for i in range(1, n + 1)]
    if aggregated_label and n == 1 and not warnings:
        warnings.append("respuesta agregada, dispersión desconocida (1 respondent row)")
    return n, labels, warnings


def _find_overall_score_col(ws: Worksheet) -> tuple[int, int]:
    """Return (header_row, score_column) for Overall Score - TOTAL."""
    for r in range(1, min(ws.max_row, 80) + 1):
        for c in range(1, min(ws.max_column, 50) + 1):
            v = ws.cell(r, c).value
            if isinstance(v, str) and OVERALL_RE.search(v):
                return r, c
    raise ValueError("could not find 'Overall Score - TOTAL' header")


def _find_countries_col(ws: Worksheet, near_row: int) -> int:
    for r in range(max(1, near_row - 2), near_row + 3):
        for c in range(1, 8):
            v = ws.cell(r, c).value
            if isinstance(v, str) and v.strip().lower() == "countries":
                return c
    # fallback: column D
    return 4


def _find_final_score_table(ws: Worksheet) -> tuple[dict[str, float], list[str]]:
    header_row, score_col = _find_overall_score_col(ws)
    countries_col = _find_countries_col(ws, header_row)
    # Data often starts on the next row after a weight row under "Countries"
    start = header_row + 1
    # If header_row itself has "Overall Score", countries may be on same row
    # as weights one row below Countries label — scan from header_row
    # Footwear: Overall at r37, Countries+weights at r38, data from r39
    # Oil: Overall at r38, Countries+weights at r39, data from r40
    for probe in range(header_row, header_row + 4):
        v = ws.cell(probe, countries_col).value
        if isinstance(v, str) and v.strip().lower() == "countries":
            start = probe + 1
            break

    scores: dict[str, float] = {}
    order: list[str] = []
    for r in range(start, min(start + 80, ws.max_row + 1)):
        name_val = ws.cell(r, countries_col).value
        if not _is_country_name(name_val):
            if scores:
                break
            continue
        name = str(name_val).strip()
        raw = ws.cell(r, score_col).value
        if not isinstance(raw, (int, float)):
            continue
        scores[name] = float(raw)
        order.append(name)
    if not scores:
        raise ValueError("could not locate final IMSFE score table")
    return scores, order


def _detect_directions_from_formulas(
    ws_formula: Worksheet,
    var_labels_by_col: dict[int, str],
) -> dict[str, str]:
    """DMP if formula uses MAX, IMP if MIN (on the standardised data rows)."""
    out: dict[str, str] = {}
    # Probe a few data rows for formulas
    for r in range(30, 50):
        for c, label in var_labels_by_col.items():
            code = _code_from_label(label)
            if not code or code in out:
                continue
            cell = ws_formula.cell(r, c).value
            if not isinstance(cell, str) or not cell.startswith("="):
                continue
            up = cell.upper()
            if "SUMPRODUCT" in up:
                continue
            if "MAX(" in up:
                out[code] = "DMP"
            elif "MIN(" in up:
                out[code] = "IMP"
        if len(out) >= len(var_labels_by_col):
            break
    return out


def _variable_header_cols(ws: Worksheet) -> dict[int, str]:
    """Map column index → variable label that contains a (CODE)."""
    out: dict[int, str] = {}
    for r in range(1, 45):
        for c in range(1, min(ws.max_column, 50) + 1):
            v = ws.cell(r, c).value
            if isinstance(v, str) and _code_from_label(v):
                out[c] = v.strip()
        if len(out) >= 15:
            break
    return out


def read_imsfe_workbook(path: Path | str) -> WorkbookImportReport:
    """Load workbook and return anonymised import report + final scores."""
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(p)

    label = _path_label(p)
    wb_data = load_workbook(p, data_only=True)
    wb_form = load_workbook(p, data_only=False)
    try:
        std = _sheet(wb_data, "3. Standardization of criteria")
        std_f = _sheet(wb_form, "3. Standardization of criteria")
        weights_ws = _sheet(wb_data, "2. Weights % and sources")
        avg = _sheet(wb_data, "1. Total Average for criteria")

        origin = _find_origin(std)
        hs = _find_hs(std)
        scale = _find_scale(std)
        crit_w, var_w, assumptions = _read_weights(weights_ws)
        n_experts, expert_labels, expert_warnings = _count_experts_anonymized(avg)

        header_cols = _variable_header_cols(std)
        directions = _detect_directions_from_formulas(std_f, header_cols)
        for code in var_w:
            directions.setdefault(code, "UNKNOWN")

        final_scores, order = _find_final_score_table(std)
        warnings: list[str] = list(expert_warnings)
        if abs(sum(crit_w.values()) - 1.0) > 1e-3:
            warnings.append(
                f"criterion weights sum to {sum(crit_w.values()):.6f} (not 1)",
            )
        unknown_dir = [k for k, v in directions.items() if v == "UNKNOWN"]
        if unknown_dir:
            assumptions.append(
                f"direction UNKNOWN for: {', '.join(sorted(unknown_dir))}",
            )

        return WorkbookImportReport(
            path=str(p.resolve()),
            path_label=label,
            origin=origin,
            hs_code=hs,
            scale=scale,
            n_criteria=len(crit_w),
            n_variables=len(var_w),
            n_experts=n_experts,
            expert_labels=expert_labels,
            criterion_weights=crit_w,
            variable_weights=var_w,
            variable_direction=directions,
            final_scores=final_scores,
            preselected_countries=order,
            assumptions=assumptions,
            warnings=warnings,
        )
    finally:
        wb_data.close()
        wb_form.close()


def assert_no_personal_names(report: WorkbookImportReport) -> None:
    """Test helper: expert labels and serialised report must stay anonymous."""
    for label in report.expert_labels:
        if not re.fullmatch(r"Expert \d+", label):
            raise AssertionError(f"non-anonymous expert label: {label!r}")
    blob = str(report.to_dict()).lower()
    forbidden = (
        "bonilla",
        "barahona",
        "baena",
        "cano arenas",
        "professor",
        "@",
        "jiménez",
        "jimenez",
        "pajares",
        "baltodano",
    )
    for token in forbidden:
        if token in blob:
            raise AssertionError(f"personal token leaked into report: {token}")
