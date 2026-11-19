# Manual drop: wits_trains

Publisher: World Bank / UNCTAD (WITS)

Where a human downloads it: <https://wits.worldbank.org/> (landing page from `catalog/sources.yaml`; check the publisher's terms before use).

## What to place here

Nothing to download by hand: the live extract calls the WITS TRN SDMX API. It needs a
scope file `config/wits_trains.json` that you write (not shipped):

```json
{
  "version": "<label for this pull, e.g. a date>",
  "reporters": ["<destination ISO3>", "..."],
  "partners": ["<origin ISO3>", "..."],
  "years": [<first>, <last>],
  "hs_chapters": ["<two-digit HS chapter>", "..."]
}
```

Pattern (from the ims-backtest WITS README): `.../datasource/TRN/reporter/{rep}/partner/{origin}/product/all/year/{y}/datatype/{reported|aveestimated}`.
EU members use reporter `918`; GBR uses `918` for years up to 2020. Lines with non-ad-valorem
rates use the `aveestimated` series. There is **no** MFN fallback and **no** LOCF: a
destination/origin/year without data is a gap, listed in
`data/raw/wits_trains/<version>/summary.json` (`gaps`), and is absent from `tariffs.csv`.
Raw XML is cached under `xml/` in the same folder. ISO numeric codes come from
`config/iso3_numeric.yaml`.

WITS terms are unverified (login-gated), so this source stays local_only/BYOD and is
never released.

## Optional pin file

`config/pins/wits_trains.json` (tracked) fixes what you downloaded so later runs can verify it:

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
