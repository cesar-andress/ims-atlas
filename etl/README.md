# imsatlas_etl

Python ETL for IMS Atlas data releases.

## Commands

```bash
uv run atlas-etl catalog-validate
uv run atlas-etl build
uv run atlas-etl release
```

## ims-backtest pin

Phase 0 requires a **git tag** (not a branch) of
[ims-backtest](https://github.com/cesar-andress/ims-backtest). Set
`config/ims-backtest.json` → `tag`, then run `make pin-backtest`.
