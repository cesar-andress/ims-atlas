# imsatlas_etl

Python ETL for IMS Atlas data releases.

## Commands

```bash
uv run atlas-etl catalog-validate
uv run atlas-etl build
uv run atlas-etl release
```

## Live runs

```bash
uv run atlas-etl run --live          # check -> extract -> validate -> transform -> qa -> lineage
uv run atlas-etl run --fixture-root tests/fixtures/mini_world --force   # mode=fixture
```

Exit codes: 0 ok, 1 QA block or failure, 2 source unreachable (network error or a
required manual drop / `config/wits_trains.json` missing).

World Bank sources are pulled from the API v2 (rate-limited, retried with backoff);
BACI, CEPII Gravity and the index sources are read from `data/manual/<source>/`
(see the README in each folder; the folders are gitignored). WITS TRN needs the
network and stays local_only. Every run appends to `status/history.jsonl` and writes
`status/changes/<run_id>.json` (new years/countries/cells, revisions, version change).
Fixture-mode artefacts are exported with `is_fixture: true`.

## ims-backtest pin

Phase 0 requires a **git tag** (not a branch) of
[ims-backtest](https://github.com/cesar-andress/ims-backtest). Set
`config/ims-backtest.json` → `tag`, then run `make pin-backtest`.
