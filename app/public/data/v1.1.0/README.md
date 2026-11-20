# IMS Atlas data release v1.1.0

## Cite

See the repository [CITATION.cff](https://github.com/cesar-andress/ims-atlas/blob/main/CITATION.cff).
Companion engine: [ims-backtest](https://github.com/cesar-andress/ims-backtest).

## Contents (SPEC §3)

| Path | Description | Rows |
| --- | --- | ---: |
| `country_year.parquet` | Long country panel | 18113 |
| `bilateral_year.parquet` | Long bilateral | 4776480 |
| `trade/hs2=*/part.parquet` | Trade by HS2 | 11368115 |
| `country_product/hs2=*/year=*/variable_id=*/` | Product metrics | 87034482 |
| `provenance/variable_id=*/year=*/part.parquet` | One row per release cell | 4794593 |
| `provenance.jsonl` | Same rows as JSON lines (tiny releases only) | |
| `catalog.json` | Shipped variables + HS nomenclature | |
| `manifest.json` | Hashes, versions, gate decisions, signature status | |
| `SHA256SUMS` | `sha256sum` digests of every other file | |
| `LICENSES.md` | Licences for shipped vars | |

## Column dictionary

### country_year / bilateral_year

- `variable_id`: catalog id
- `value`: numeric observation
- `flag_imputed` / `flag_locf`: boolean; true only when imputation/LOCF was applied

### provenance

One row per cell of `country_year` / `bilateral_year`: `table`, entity ids,
`year`, `variable_id`, `source_id`, `upstream_code`, `upstream_version`,
`request_url_or_file`, `row_key`, `raw_sha256`, `transform_steps`,
`flag_imputed`, `flag_locf`, `flag_unit_converted`, `flag_iso3_remap`, `value`.
Verify integrity with `atlas-etl verify-release <dir>`.

### trade parts

- `exporter`, `importer`: ISO3
- `year`: integer
- `value_usd`: trade value

## Gate

Variables with decision `byod_only` or `local_only` are **not** included. Users may
upload BYOD CSV locally in the app (never uploaded to a server).
