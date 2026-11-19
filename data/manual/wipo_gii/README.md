# Manual drop: wipo_gii

Publisher: World Intellectual Property Organization

Where a human downloads it: <https://www.wipo.int/global_innovation_index/> (landing page from `catalog/sources.yaml`; check the publisher's terms before use).

## What to place here

`values.csv` with columns `year,value` plus `iso3` and/or `country_name`. Country names
are mapped to ISO3 only through the explicit allow-list in `etl/src/imsatlas_etl/iso3.py`;
an unmatched name fails `validate` (add the verified spelling there, or supply `iso3`).

## Optional pin file

`config/pins/wipo_gii.json` (tracked) fixes what you downloaded so later runs can verify it:

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
