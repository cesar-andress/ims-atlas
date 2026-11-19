# Manual drop: baci

Publisher: CEPII

Where a human downloads it: <https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37> (landing page from `catalog/sources.yaml`; check the publisher's terms before use).

## What to place here

The BACI release zip as distributed by CEPII (one `*.zip`). It must contain
`country_codes*.csv` (columns `country_code`, `country_iso3`) and one or more
`BACI_*.csv` trade files (columns `t,i,j,k,v,q`).

`atlas-etl extract --source baci` verifies the pin (if any), unzips under
`data/raw/baci/<version>/zip_members/`, and writes `trade.csv`
(`year,exporter,importer,hs6,value_usd`). Country codes are mapped to ISO3 with the
zip's own country table; rows with an unmapped country, a null value, or a year before
1990 are counted in the `.meta.json` sidecar (`discards`), not dropped silently.

`value_usd` is `v * value_scale`. The default `value_scale` is 1000 (BACI reports
thousands of current USD per CEPII documentation); a human must confirm this against
the release notes of the file used, and can override it through `options.value_scale`
in the pin file. Other optional pin `options`: `year_min`, `year_max`, `hs_chapters`
(list of two-digit chapters). If several zips are present, set `filename` in the pin.

## Optional pin file

`config/pins/baci.json` (tracked) fixes what you downloaded so later runs can verify it:

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
