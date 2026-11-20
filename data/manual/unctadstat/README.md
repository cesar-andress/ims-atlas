# Manual drop: unctadstat

Publisher: UNCTAD (UNCTADstat)

Landing page (`catalog/sources.yaml`): <https://unctadstat.unctad.org/>

## Why there is no automatic fetch

The Data Centre (<https://unctadstat.unctad.org/datacentre/dataviewer/US.TradeMerchTotal>,
HTTP 200 on 2026-11-20) is a single-page application. Its configuration points to a
private API behind a Microsoft sign-in client; no public bulk-download endpoint was
verified, so none is called.

## What to place here

Export the table you need from the Data Viewer and reshape it to the canonical
`indicators.csv` with columns `iso3,year,indicator,value` (long format; `indicator` =
UNCTADstat table code such as `US.TradeMerchTotal`; economies only, no aggregates; blanks
left blank). Do not fill gaps.

Terms page (`catalog/sources.yaml`): <https://unctadstat.unctad.org/EN/About.html>

## Optional pin file

`config/pins/unctadstat.json` (tracked) fixes what you dropped so later runs can verify it:

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
