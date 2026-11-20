# Manual drop (optional override): wipo_gii

Publisher: World Intellectual Property Organization (Global Innovation Index)

Landing page (`catalog/sources.yaml`): <https://www.wipo.int/global_innovation_index/en/>

## Automatic fetch (default)

`atlas-etl check/extract --source wipo_gii` (live) downloads the "GII <year> Database"
workbooks that the publication pages list under "Download data". Opened with `curl` on
2026-11-20 (HTTP 200):

- GII 2026: <https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2026-tech1.xlsx>
  (page: <https://www.wipo.int/publications/en/details.jsp?id=4873>)
- GII 2025: <https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2025-tech1.xlsx>
  (page: <https://www.wipo.int/publications/en/details.jsp?id=4807>)

From the `Data` sheet only the row `NAME == Global Innovation Index` is kept per economy
(overall score, 0-100); `year` is the GII edition. The WIPO copyright page
(<https://www.wipo.int/web-publications/global-innovation-index-2025/en/copyright.html>)
answered 403 to `curl`, so the licence text was not re-read.

## Manual override

Place a canonical `values.csv` here (`iso3,year,value`, or `country_name` instead of
`iso3`; names map to ISO3 only through the allow-list in
`etl/src/imsatlas_etl/iso3.py`). It **wins over the network**.

## Optional pin file

`config/pins/wipo_gii.json` (tracked) fixes what you dropped so later runs can verify it:

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
