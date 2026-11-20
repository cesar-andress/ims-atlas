# Manual drop: yale_epi

Publisher: Yale Center for Environmental Law & Policy

Landing: <https://epi.yale.edu/> · downloads: <https://epi.yale.edu/2026/downloads>

## Automatic fetch (preferred)

The live extract downloads the verified 2026 results workbook:

`https://epi.yale.edu/sites/default/files/2026-09/epi2026results2026-07-07.xlsx`

Sheet `data` columns used: `iso`, `EPI.new` → tidy `values.csv` (`iso3,year,value`)
with `year=2026`. Manual drop below wins if present.

## Optional manual drop

`values.csv` with columns `year,value` plus `iso3` and/or `country_name`.

## Optional pin file

`config/pins/yale_epi.json` (tracked) fixes what you downloaded so later runs can verify it.

## Rules

- This folder is **gitignored** except this README. Never commit drops.
- The ETL never invents a download URL; the connector URL was verified HTTP 200
  on 2026-11-20 before wiring.
