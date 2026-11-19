# Manual drop: cepi_gravity

Publisher: CEPII

Where a human downloads it: <https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=8> (landing page from `catalog/sources.yaml`; check the publisher's terms before use).

## What to place here

The CEPII Gravity release zip (one `*.zip`) containing the main CSV table (the largest
CSV in the archive is used). Required columns (first match wins): origin
`iso3_o`; destination `iso3_d`; `year`; distance `distw_harmonic` (else `distw`);
`comlang_off`; `fta_wto`.

`atlas-etl extract --source cepi_gravity` verifies the pin (if any), unzips under
`data/raw/cepi_gravity/<version>/zip_members/`, and writes `bilateral.csv`
(`origin,destination,year,distw,comlang_off,fta_wto`). Counts of rows outside the year
range, duplicate keys (the row with most non-null covariates is kept) and rows with a
missing covariate are recorded under `discards` in the `.meta.json` sidecar. No
imputation is performed. Optional pin `options`: `year_min`, `year_max`. If several
zips are present, set `filename` in the pin.

## Optional pin file

`config/pins/cepi_gravity.json` (tracked) fixes what you downloaded so later runs can verify it:

```json
{
  "version": "<release label you read on the publisher page>",
  "sha256": "<sha256 of the file>",
  "bytes": <size in bytes>,
  "url": null
}
```

`url` may be `null`; it is recorded for provenance only and is never fetched. With a pin
present, size and sha256 are verified before anything is read. Without a pin the version
is `manual-<first 12 hex of the file sha256>`.

## Rules

- This folder is **gitignored** except this README. Never commit the files you drop here.
- Rights for this source are **not human-verified** in `catalog/sources.yaml`; the
  publication gate treats it as BYOD / local-only until a human completes the rights
  check. Nothing derived from this drop is shipped publicly unless the gate says so.
- The ETL never downloads this source and never guesses a download URL.
