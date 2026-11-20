"""Minimal, dependency-free ``.xlsx`` reader (stdlib ``zipfile`` + ElementTree).

openpyxl rejects the *strict* OOXML dialect (``purl.oclc.org`` namespaces) used
by the Transparency International CPI workbook: it loads zero worksheets
without raising. This reader matches element names by local name, so it reads
both the transitional and the strict dialect. It returns cell *values* only
(no formulas, styles or dates-as-dates): numbers become ``float``, shared and
inline strings become ``str``, empty cells are omitted.
"""

from __future__ import annotations

import io
import re
import zipfile
from collections.abc import Iterator
from typing import Any
from xml.etree import ElementTree as ET

_CELL_REF = re.compile(r"^([A-Z]+)(\d+)$")


class XlsxError(ValueError):
    """The workbook is malformed or a requested sheet is missing."""


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _text(element: ET.Element) -> str:
    return "".join(t.text or "" for t in element.iter() if _local(t.tag) == "t")


class Workbook:
    """Read-only view of the sheets of one in-memory ``.xlsx`` file."""

    def __init__(self, data: bytes) -> None:
        try:
            self._zip = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile as exc:
            raise XlsxError("not a zip/xlsx file") from exc
        self._shared = self._load_shared_strings()
        self._targets = self._load_sheet_targets()

    @property
    def sheet_names(self) -> list[str]:
        return list(self._targets)

    def _load_shared_strings(self) -> list[str]:
        name = "xl/sharedStrings.xml"
        if name not in self._zip.namelist():
            return []
        root = ET.fromstring(self._zip.read(name))
        return [_text(si) for si in root if _local(si.tag) == "si"]

    def _load_sheet_targets(self) -> dict[str, str]:
        try:
            book = ET.fromstring(self._zip.read("xl/workbook.xml"))
            rels = ET.fromstring(self._zip.read("xl/_rels/workbook.xml.rels"))
        except KeyError as exc:
            raise XlsxError(f"missing part {exc}") from exc
        by_id = {
            rel.get("Id"): str(rel.get("Target"))
            for rel in rels
            if _local(rel.tag) == "Relationship"
        }
        targets: dict[str, str] = {}
        for sheet in book.iter():
            if _local(sheet.tag) != "sheet":
                continue
            rid = next(
                (v for k, v in sheet.attrib.items() if _local(k) == "id"),
                None,
            )
            target = by_id.get(rid)
            if target is None:
                continue
            path = target.lstrip("/")
            targets[str(sheet.get("name"))] = (
                path if path.startswith("xl/") else f"xl/{path}"
            )
        return targets

    def find_sheet(self, pattern: str) -> str:
        """Return the unique sheet name matching ``pattern`` (case-insensitive)."""
        regex = re.compile(pattern, re.IGNORECASE)
        hits = [n for n in self._targets if regex.search(n.strip())]
        if len(hits) != 1:
            raise XlsxError(
                f"expected exactly one sheet matching {pattern!r}, "
                f"found {hits} among {self.sheet_names}",
            )
        return hits[0]

    def iter_rows(self, sheet: str) -> Iterator[tuple[int, dict[str, Any]]]:
        """Yield ``(row_number, {column_letters: value})`` for non-empty rows."""
        if sheet not in self._targets:
            raise XlsxError(f"no sheet {sheet!r}; have {self.sheet_names}")
        with self._zip.open(self._targets[sheet]) as fh:
            for _event, el in ET.iterparse(fh, events=("end",)):
                if _local(el.tag) != "row":
                    continue
                cells: dict[str, Any] = {}
                for cell in el:
                    if _local(cell.tag) != "c":
                        continue
                    match = _CELL_REF.match(cell.get("r") or "")
                    if match is None:
                        continue
                    value = self._cell_value(cell)
                    if value is not None and value != "":
                        cells[match.group(1)] = value
                number = int(el.get("r") or 0)
                el.clear()
                if cells:
                    yield number, cells

    def _cell_value(self, cell: ET.Element) -> Any:
        kind = cell.get("t")
        if kind == "inlineStr":
            return _text(cell)
        raw = None
        for child in cell:
            if _local(child.tag) == "v":
                raw = child.text
        if raw is None:
            return None
        if kind == "s":
            return self._shared[int(raw)]
        if kind in {"str", "e"}:
            return raw
        if kind == "b":
            return raw == "1"
        try:
            return float(raw)
        except ValueError:
            return raw
