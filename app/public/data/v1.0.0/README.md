# IMS Atlas data release v1.0.0

## Cite

See the repository [CITATION.cff](https://github.com/cesar-andress/ims-atlas/blob/main/CITATION.cff).
Companion engine: [ims-backtest](https://github.com/cesar-andress/ims-backtest).

## Contents (SPEC §3)

| Path | Description | Rows |
| --- | --- | ---: |
| `country_year.parquet` | Long country panel | 0 |
| `bilateral_year.parquet` | Long bilateral | 0 |
| `trade/hs2=*/part.parquet` | Trade by HS2 | 0 |
| `catalog.json` | Shipped variables only | |
| `manifest.json` | Hashes, versions, gate decisions | |
| `LICENSES.md` | Licences for shipped vars | |

## Column dictionary

### country_year / bilateral_year

- `variable_id`: catalog id
- `value`: numeric observation
- `flag_imputed` / `flag_locf`: boolean; true only when imputation/LOCF was applied

### trade parts

- `exporter`, `importer`: ISO3
- `year`: integer
- `value_usd`: trade value

## Gate

Variables with decision `byod_only` or `local_only` are **not** included. Users may
upload BYOD CSV locally in the app (never uploaded to a server).
