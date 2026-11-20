"""Regenerate the Step 3 recorded-shape fixtures (deterministic bytes).

Run: ``python etl/tests/fixtures/step3_live/make_fixtures.py``

These are hand-made test doubles that copy the *layout* observed in the
publisher files on 2026-11-20 (sheet names, header rows, column labels, OOXML
dialect). Every number is synthetic; none is a publisher figure.
"""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).parent
STAMP = (2026, 1, 1, 0, 0, 0)


def _zip(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in members.items():
            info = zipfile.ZipInfo(name, date_time=STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, data)
    return buf.getvalue()


def _col(index: int) -> str:
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def build_xlsx(
    sheets: dict[str, list[list[object]]],
    *,
    strict: bool,
    inline: bool,
) -> bytes:
    """Minimal workbook; ``strict`` switches to the purl.oclc.org namespaces."""
    main = (
        "http://purl.oclc.org/ooxml/spreadsheetml/main"
        if strict
        else "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    )
    rel_ns = (
        "http://purl.oclc.org/ooxml/officeDocument/relationships"
        if strict
        else "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    )
    shared: list[str] = []

    def cell(ref: str, value: object) -> str:
        if value is None:
            return ""
        if isinstance(value, (int, float)):
            return f'<c r="{ref}"><v>{value}</v></c>'
        text = str(value)
        if inline:
            return f'<c r="{ref}" t="inlineStr"><is><t>{escape(text)}</t></is></c>'
        if text not in shared:
            shared.append(text)
        return f'<c r="{ref}" t="s"><v>{shared.index(text)}</v></c>'

    members: dict[str, bytes] = {}
    sheet_tags, rel_tags = [], []
    for n, (name, rows) in enumerate(sheets.items(), start=1):
        body = []
        for r, row in enumerate(rows, start=1):
            cells = "".join(cell(f"{_col(c)}{r}", v) for c, v in enumerate(row))
            body.append(f'<row r="{r}">{cells}</row>')
        members[f"xl/worksheets/sheet{n}.xml"] = (
            f'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="{main}">'
            f"<sheetData>{''.join(body)}</sheetData></worksheet>"
        ).encode()
        sheet_tags.append(f'<sheet name="{escape(name)}" sheetId="{n}" r:id="rId{n}"/>')
        rel_tags.append(
            f'<Relationship Id="rId{n}" Type="{rel_ns}/worksheet" '
            f'Target="worksheets/sheet{n}.xml"/>',
        )
    members["xl/workbook.xml"] = (
        f'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="{main}" '
        f'xmlns:r="{rel_ns}"><sheets>{"".join(sheet_tags)}</sheets></workbook>'
    ).encode()
    members["xl/_rels/workbook.xml.rels"] = (
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns='
        '"http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{''.join(rel_tags)}</Relationships>"
    ).encode()
    if not inline:
        items = "".join(f"<si><t>{escape(s)}</t></si>" for s in shared)
        members["xl/sharedStrings.xml"] = (
            f'<?xml version="1.0" encoding="UTF-8"?><sst xmlns="{main}">{items}</sst>'
        ).encode()
    return _zip(members)


def cpi_xlsx() -> bytes:
    header = [
        "Country / Territory",
        "ISO3",
        "Region",
        "CPI score 2025",
        "Rank 2025",
        "CPI score 2024",
        "Rank 2024",
    ]
    rows: list[list[object]] = [
        ["Corruption Perceptions Index 2025: Score timeseries since 2012"],
        ["EMBARGOED UNTIL 10.02.2026"],
        [],
        header,
        ["Testland A", "TSA", "WE/EU", 80, 1, 79, 1],
        ["Testland B", "TSB", "AP", 40, 2, None, None],  # 2024 score missing
        ["Testland C", "tsc", "AME", 20, 3, 21, 2],  # lower-case iso3 is normalised
        ["Note: synthetic fixture row without an ISO3 code", None],  # footnote row
    ]
    sheets = {
        "CPI2025": [["Corruption Perceptions Index 2025: Global scores"]],
        "CPI Timeseries 2012 - 2025": rows,
        "CPI Historical": [["unused sheet"]],
    }
    return build_xlsx(sheets, strict=True, inline=False)


def gii_xlsx(year: int, offset: float) -> bytes:
    header = [
        "ISO3",
        "ECONOMY_NAME",
        "NUM",
        "NAME",
        "DATAYR",
        "VALUE_SCREEN",
        "SCORE",
        "RANK",
    ]
    rows: list[list[object]] = [header]
    for iso3, base in (("TSA", 60.0), ("TSB", 40.0), ("TSC", 20.0)):
        rows.append(
            [
                iso3,
                "Testland",
                None,
                "Global Innovation Index",
                None,
                None,
                base + offset,
                1,
            ]
        )
        rows.append(
            [
                iso3,
                "Testland",
                "IN",
                "Innovation inputs",
                None,
                None,
                base + offset + 5,
                1,
            ]
        )
    rows.append(
        ["TSD", "Testland D", None, "Global Innovation Index", None, None, None, None]
    )  # no score
    sheets = {
        "Index Structure": [["synthetic"]],
        "Economies": [["ISO3", "ECONOMY_NAME"], ["TSA", "Testland"]],
        "Data": rows,
        "Metadata": [["synthetic"]],
    }
    return build_xlsx(sheets, strict=False, inline=True)


def db_zip() -> bytes:
    years = ["2017", "2018", "2019"]
    head = (
        '"Country Name","Country Code","Indicator Name","Indicator Code",'
        + ",".join(f'"{y}"' for y in years)
        + ',""\n'
    )

    def row(name: str, code: str, ind: str, vals: list[str]) -> str:
        cells = ",".join(f'"{v}"' for v in vals)
        return f'"{name}","{code}","name of {ind}","{ind}",{cells},""\n'

    data = head
    data += row("Testland A", "TSA", "IC.BUS.EASE.DFRN.XQ.DB1719", ["70.5", "71.5", ""])
    data += row("Testland A", "TSA", "IC.BUS.EASE.XQ", ["10", "9", "8"])
    data += row("Testland A", "TSA", "IC.CNST.PRMT.DFRN.DB1619", ["1", "2", "3"])
    data += row("Testland B", "TSB", "IC.BUS.EASE.XQ", ["", "20", "21"])
    data += row(
        "Test City", "TSB_CTY", "IC.BUS.EASE.XQ", ["5", "5", "5"]
    )  # subnational
    data += row("Test Region", "TRG", "IC.BUS.EASE.XQ", ["1", "1", "1"])  # aggregate
    country = (
        '\ufeff"Country Code","Short Name","Region"\n'
        '"TSA","Testland A","Europe & Central Asia"\n'
        '"TSB","Testland B","South Asia"\n'
        '"TRG","Test Region",""\n'
    )
    return _zip(
        {
            "DBData.csv": data.encode(),
            "DBCountry.csv": country.encode("utf-8"),
            "DBSeries.csv": b'"Series Code","Topic"\n',
        },
    )


def main() -> None:
    (HERE / "CPI_results_shape.xlsx").write_bytes(cpi_xlsx())
    (HERE / "GII_2025_shape.xlsx").write_bytes(gii_xlsx(2025, 0.0))
    (HERE / "GII_2026_shape.xlsx").write_bytes(gii_xlsx(2026, 1.5))
    (HERE / "DB_CSV_shape.zip").write_bytes(db_zip())


if __name__ == "__main__":
    main()
