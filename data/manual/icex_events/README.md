# Manual drop — ICEX events / offices

Prefer datos.gob.es catalogue entry for «Buscador de ferias del ICEX» when the
licence on the ficha allows reuse. Otherwise drop CSV here.

Expected columns: see `config/promotion_agencies.yaml` / promotion_event model
(`origin_iso3=ESP`, `agency=icex`, `dest_iso3`, `event_type`, `sector`, dates).

Offices list (PROMO_OFFICE): one row per `dest_iso3` with city and source_url.
