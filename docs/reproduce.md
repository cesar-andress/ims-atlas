# Reproducing and verifying a release

This page describes the integrity tooling around `data/release/{staging,public}/vX.Y.Z`.
Two paths exist and they prove different things.

| Path | Network | Proves |
| --- | --- | --- |
| Fixture (`make reproduce-release`, default) | none | The release builder is deterministic: recorded `mini_world` fixtures -> curated -> release give the same bytes as the reference tree. Run in CI. |
| Curated/live (human, manual) | live pulls happen earlier, in `atlas-etl run --live` | The release matches what the local `data/curated/` and `status/freshness.json` produce. It does **not** prove the upstream publishers still serve the same numbers; use `spot-check` for that. |

The fixture path says nothing about real publisher data. `mini_world` is a test
world, and a release built from it carries `mini-*` source versions.

## Verify a release (hashes)

```bash
cd etl && uv run atlas-etl verify-release ../data/release/public/v1.0.0
# or: make verify-release VERSION=1.0.0
```

Exit code 0: every file matches `SHA256SUMS` (format `<sha256>  <path>`, readable by
`sha256sum -c`), no file is unlisted, and every `manifest.files[]` entry matches on
`sha256`, `bytes` and `rows`. Exit code 1: any mismatch, missing file or missing
`SHA256SUMS`. Releases built before `SHA256SUMS` existed (v0.1.0, v1.0.0 in this
tree) fail this check by design.

`manifest.json` carries `signature`. It is `{"status": "unsigned", ...}` unless
`ATLAS_RELEASE_SIGNED=1` is set **and** `git verify-tag vX.Y.Z` succeeds at build time.
A tag is normally created after the build, so a release is usually recorded as
unsigned. No signature is ever fabricated.

## Reproduce a release (bytes)

```bash
make reproduce-release VERSION=1.0.0              # fixture path (default)
make reproduce-release VERSION=1.0.0 FIXTURE=     # rebuild from local data/curated
make reproduce-release VERSION=1.0.0 REPRO_ARGS=--allow-extra
```

The command rebuilds the release into a scratch directory (the reference is never
written) and compares it with `data/release/public/vVERSION`, or with
`data/release/staging/vVERSION` when no public tree exists.

* Every file except `manifest.json`, `CHANGELOG.md` and `SHA256SUMS` is compared
  byte for byte. Those three carry build timestamps, promotion metadata or
  signature state.
* `manifest.json` is compared field by field, ignoring `created_at`,
  `promoted_at`, `promoted_by`, `staging`, `signature`, `files` and `size_bytes`
  (the last two follow from the file comparison).
* Exit code 1 lists `missing_in_candidate`, `extra_in_candidate`, `differing` and
  manifest fields that differ. `--allow-extra` tolerates files or manifest keys that
  exist only in the rebuild, for releases that predate a newer artefact.

Known state of this tree: v1.0.0 was built before `provenance.parquet` existed.
Reproducing it reports the new file as extra, plus differences in `README.md`
(it now documents provenance) and `manifest.row_counts` (`provenance_rows`). The
data tables, `catalog.json` and `LICENSES.md` match. Do not rebuild v1.0.0 to hide
this; publish a new version instead.

## Provenance table

Each release contains `provenance.parquet` with one row per cell of
`country_year` and `bilateral_year`: `table`, `iso3` (or `iso3_o`/`iso3_d`),
`year`, `variable_id`, `source_id`, `upstream_code`, `upstream_version`,
`request_url_or_file`, `row_key`, `raw_sha256`, `transform_steps`,
`flag_imputed`, `flag_locf`, `flag_unit_converted`, `flag_iso3_remap`, `value`.

* `row_key` is the natural key of the raw row (entity ids, year and, when the raw
  table has one, the upstream code). `raw_sha256` hashes the raw table the cell
  was read from.
* `upstream_code` is null when the raw table has a single unnamed series
  (the index sources).
* A release with zero cells (all variables `byod_only`) still ships
  `provenance.parquet` with the full schema and zero rows. Tiny releases
  (1 to 200 cells) also ship `provenance.jsonl`.
* The builder fails (no silent drop) when a cell cannot be traced to a catalog
  variable, a registered source and an existing raw artefact.

## Spot check (live, human)

```bash
cd etl && uv run atlas-etl spot-check --n 200 --seed 1
cd etl && uv run atlas-etl spot-check --n 200 --seed 1 --fixture-responses DIR
```

Draws a seeded sample from the World Bank cells of the current public release
provenance and re-fetches each one from
`api.worldbank.org/v2/country/{iso3}/indicator/{code}?format=json&date={year}`.
Output: `status/spot_check.json` with `generated_at`, `seed`, `n`, `n_sampled`,
`matches`, `mismatches`, `unreachable` and `samples`. A mismatch is informative:
the World Bank revises series, so a mismatch is not by itself an ETL error.
With `--fixture-responses`, responses come from files named
`{iso3}_{year}_{code}.json` (World Bank v2 JSON); tests use only these. Without it
the command uses the network (0.5 s between requests). With no public release,
zero cells or no World Bank cells, an empty report (`n_sampled: 0`) is written.
Non-World-Bank sources are manual drops and cannot be re-fetched per cell.

## Terms drift

`atlas-etl terms-check` (network, human) stores the current terms-page digest in
`status/terms/<source>.json` and never edits rights evidence.
`atlas-etl check` then sets `terms_changed` on each freshness row:
`true` when both `rights.evidence.snapshot_sha256` and the stored digest exist and
differ, `false` when equal, `null` when either is missing. The value is exported in
`status/sources.json` under `freshness.terms_changed`. A digest change means the
page bytes changed (markup counts), not necessarily the terms; a human reviews it.
