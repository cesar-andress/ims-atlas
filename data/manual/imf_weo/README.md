# Manual drop: imf_weo (BYOD / cerrada store only)

Publisher: International Monetary Fund (World Economic Outlook)

Landing page (`catalog/sources.yaml`): <https://www.imf.org/en/Publications/WEO>

## Why there is no automatic fetch

- The SDMX URL `https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/~/*`
  returned 404 in a verified session, so it is not used.
- `https://data.imf.org/datasets/WEO` and the pages under `www.imf.org` returned 403 to
  `curl` on 2026-11-20 (bot protection; not circumvented). Open them in a browser.

Dataset page: <https://data.imf.org/datasets/WEO>. Terms: <https://www.imf.org/en/about/copyright-and-terms>
(`catalog/sources.yaml` records `commercial_use: "no"`, so keep this source in the
cerrada store).

## What to place here

`indicators.csv` with columns `iso3,year,indicator,value` (long format; `indicator` = the
WEO subject code you downloaded; economies only; estimates and projections are not
distinguished by this table, so keep only the vintage you intend to use and record it in
the pin `version`). Do not fill gaps.

## Optional pin file

`config/pins/imf_weo.json` (tracked) fixes what you dropped so later runs can verify it:

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
