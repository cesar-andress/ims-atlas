# Manual drop (optional override): inform_risk

Publisher: European Commission, DRMKC (INFORM Risk Index, INRI)

Landing page (`catalog/sources.yaml`): <https://drmkc.jrc.ec.europa.eu/inform-index>

## Automatic fetch (default)

`atlas-etl check/extract --source inform_risk` (live) reads the overall index from the
publisher's HDX dataset. URLs opened with `curl` on 2026-11-20 (HTTP 200):

- <https://data.humdata.org/api/3/action/package_show?id=f5ec2ee7-8a1b-49b4-864b-70bdb582a022>
  (version probe: `last_modified` of the trends resource)
- <https://data.humdata.org/dataset/f5ec2ee7-8a1b-49b4-864b-70bdb582a022/resource/b1d4a203-ef6e-44f7-9895-17c127aeaaee/download/inform_risk_index_trends.csv>
  (302 to object storage; the signed redirect URL is never stored)

Only rows with `IndicatorId == INFORM` (overall risk, 0-10) are kept; `year` is
`GNAYear` (the INFORM edition year). Every dropped row is counted in
`data/raw/inform_risk/<version>/summary.json`.

The sibling HDX file `inform_risk_index.csv` is not used: it is an indicator-level table
with blank indicator names and no overall-risk row.

## Manual override

The official Excel is behind a survey form at
<https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data>, so it is
not fetched. If you download it (or want to pin another vintage), place the canonical
file here; it **wins over the network**.

`values.csv` with columns `iso3,year,value` (`iso3` upper case; `value` = overall INFORM
Risk score). Do not fill gaps.

## Optional pin file

`config/pins/inform_risk.json` (tracked) fixes what you dropped so later runs can verify it:

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
