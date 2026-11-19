# Manual drop: hofstede

Publisher: Geert Hofstede / related publishers

Where a human downloads it: <https://geerthofstede.com/research-and-vsm/dimension-data-matrix/> (landing page from `catalog/sources.yaml`; check the publisher's terms before use).

## What to place here

`dimensions.csv` with columns `iso3,pdi,idv,mas,uai,ltowvs,ivr` (ISO3 upper case, one
row per country, blanks for missing). Copy the values from the publisher's dimension
data matrix; do not fill gaps.

## Optional pin file

`config/pins/hofstede.json` (tracked) fixes what you downloaded so later runs can verify it:

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
