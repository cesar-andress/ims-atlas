Hand-made, tiny files that copy the *layout* observed in the publisher files on
2026-11-20 (sheet names, header rows, column labels, OOXML dialect, HDX package
shape). They are test doubles, not recorded publisher data: every number and
country name here is synthetic. Used only by `tests/test_step3_connectors.py`,
which injects them through the connectors' `fetch` / `head` parameters (no
network).

- `CPI_results_shape.xlsx`: strict OOXML, shared strings, sheet `CPI Timeseries 2012 - 2025`.
- `GII_2025_shape.xlsx`, `GII_2026_shape.xlsx`: transitional OOXML, inline strings, sheet `Data`.
- `DB_CSV_shape.zip`: `DBData.csv`, `DBCountry.csv`, `DBSeries.csv` as in `DB_CSV.zip`.
- `inform_risk_index_trends.csv`, `hdx_package_show.json`: HDX layout.

Regenerate the binaries with `python etl/tests/fixtures/step3_live/make_fixtures.py`.
