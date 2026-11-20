# Manual drop — AUMA fairs

1. Obtain permission / check reuse terms at https://www.auma.de/ (no public
   redistribution terms found 2026-11-20).
2. Export sector fairs for the HS mapping in `config/hs_to_fair_sector.yaml`.
3. Place CSV/XLSX here (never commit the data file).
4. Expected columns (minimum): `dest_iso3`, `fair_name`, `city`, `date_start`,
   `date_end`, `sector`, `exhibitors`, `foreign_exhibitors_pct`, `source_url`.

Pipeline behaviour: if this folder has no data file, the run marks
`auma_fairs` as «falta fichero (manual)» and continues.
