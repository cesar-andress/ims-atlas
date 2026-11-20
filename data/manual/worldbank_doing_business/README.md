# Manual drop (optional override): worldbank_doing_business

Publisher: World Bank (Doing Business archive; the series is discontinued)

Landing page (`catalog/sources.yaml`): <https://archive.doingbusiness.org/en/doingbusiness>

## Automatic fetch (default)

`atlas-etl check/extract --source worldbank_doing_business` (live) downloads
<https://databank.worldbank.org/data/download/DB_CSV.zip> (linked from the data-catalog
page <https://datacatalog.worldbank.org/search/dataset/0038564/doing-business>; 301 to
`databankfiles.worldbank.org`, HTTP 200, about 1.3 MB; opened with `curl` on 2026-11-20).

Only the headline ease-of-doing-business series are kept, each under its own indicator
code because the methodology changed: `IC.BUS.EASE.DFRN.DB1014`, `IC.BUS.EASE.DFRN.DB16`,
`IC.BUS.EASE.DFRN.XQ.DB1719` (scores) and `IC.BUS.EASE.XQ` (rank). Series are never
spliced. Subnational rows (e.g. `CHN_BEI`) and aggregates are dropped and counted in
`data/raw/worldbank_doing_business/<version>/summary.json`. `year` is the column label
in `DBData.csv`.

The archive page links the World Bank's "Management review of data irregularities in the
Doing Business reports from 2016 to 2020"; read it before using the scores.

## Manual override

Place a canonical `indicators.csv` here with columns `iso3,year,indicator,value`
(long format, one row per country-year-indicator). It **wins over the network**.

## Optional pin file

`config/pins/worldbank_doing_business.json` (tracked) fixes what you dropped so later runs can verify it:

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
