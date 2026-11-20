#!/usr/bin/env bash
# César-only: set use_research=yes for the 9 open/official sources added in
# EXTRA-6…9 (OECD, WTO, national trade statistics, promotion agencies, fairs).
#
#   BY=CA scripts/research-use-confirm-open.sh --dry-run   # agents may run this
#   BY=CA scripts/research-use-confirm-open.sh             # César only; writes YAML
#
# Not included on purpose: indexmundi, world_population_review, geodatos,
# searates, procolombia, heritage_ief, eiu_democracy (terms forbid extraction)
# and coface_country_risk (local_only).
set -euo pipefail
: "${BY:?set BY to your name or initials, e.g. BY=CA}"
cd "$(dirname "$0")/../etl"

DRY=()
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY=(--dry-run)
fi

set_research() {
  uv run atlas-etl rights-set "$1" \
    --by "$BY" \
    --use-research yes \
    --basis public_terms \
    --note "$2" \
    "${DRY[@]}"
}

set_research oecd_sdmx \
  "OECD open data terms allow reuse with attribution; CA confirms internal research use."
set_research wto_timeseries \
  "WTO Timeseries API (free key); CA confirms internal research use with attribution."
set_research comexstat_br \
  "Comex Stat (MDIC, Brazil) open government data; CA confirms internal research use."
set_research datacomex_es \
  "DataComex (Spanish Ministry of Economy) public statistics; CA confirms internal research use."
set_research dane_dian_comex \
  "DANE/DIAN Colombia public foreign-trade statistics; CA confirms internal research use."
set_research icex_events \
  "ICEX data on datos.gob.es (open reuse licence); CA confirms internal research use."
set_research trade_gov_events \
  "trade.gov Data Services API (US government, free key); CA confirms internal research use."
set_research auma_fairs \
  "AUMA trade fair database public pages; CA read the terms and confirms internal research use only."
set_research ufi_stats \
  "UFI published statistics; CA read the terms and confirms internal research use only."

echo "research-use-confirm-open: done (${DRY[*]:-write})"
