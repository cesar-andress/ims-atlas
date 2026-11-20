# Manual drop (optional override): transparency_cpi

Publisher: Transparency International (Corruption Perceptions Index, CPIN)

Landing page (`catalog/sources.yaml`): <https://www.transparency.org/en/cpi>

## Automatic fetch (default)

`atlas-etl check/extract --source transparency_cpi` (live) downloads
<https://files.transparencycdn.org/images/CPI2025_Results.xlsx> (HTTP 200, about 3 MB,
opened with `curl` on 2026-11-20). `CPI2024_Results.xlsx` answered 403 in the same
session, so only the 2025 workbook is configured. The workbook is in the strict OOXML
dialect and is read with the built-in `xlsx_min` reader. Every `CPI score YYYY` column of
the sheet `CPI Timeseries ...` becomes `(iso3, YYYY, score)`; `year` is the CPI year.
Discards are counted in `data/raw/transparency_cpi/<version>/summary.json`.

## Manual override

If the download is blocked (403) or the publisher moves the file, download the CPI
results workbook from the landing page, reshape it, and place the canonical file here;
it **wins over the network**.

`values.csv` with columns `iso3,year,value` (`value` = CPI score, 0-100).

## Optional pin file

`config/pins/transparency_cpi.json` (tracked) fixes what you dropped so later runs can verify it:

```json
{
  "version": "<release label you read on the publisher page>",
  "sha256": "<sha256 of the file>",
  "bytes": <size in bytes>,
  "url": null
}
```

`url` is recorded for provenance only and is never fetched. With a pin present, size and
sha256 are verified before anything is read. Without a pin the version is
`manual-<first 12 hex of the file sha256>`.

## Rules

- This folder is **gitignored** except this README. Never commit the files you drop here
  or the downloads the connector writes under `data/raw/`.
- This ETL never sets `rights`, `checked_by` or `verified`. Rights for this source are
  **not human-verified** by the pipeline; the publication gate reads
  `catalog/sources.yaml` and treats anything without complete evidence as BYOD / local-only.
