#!/usr/bin/env bash
# César-only: set use_research=yes for new Tier-A sources added in EXTRA R-1
# (ECB FX, VAT table, UN Comtrade, OECD country risk, WTO ePing, EU Access2Markets,
# UN WPP). Agents may only run with --dry-run.
#
#   BY=CA scripts/research-use-confirm-extra-a.sh --dry-run
#   BY=CA scripts/research-use-confirm-extra-a.sh
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

set_research ecb_fx \
  "ECB eurofxref statistics may be reused with attribution; CA confirms internal research use."
set_research vat_rates \
  "Compiled VAT table cites national authorities; CA confirms internal research use of the compiled file."
set_research un_comtrade \
  "UN Comtrade free API (daily limits); CA confirms internal research use with attribution."
set_research oecd_country_risk \
  "OECD country risk classification public pages; CA confirms internal research use (Coface substitute)."
set_research wto_eping \
  "WTO ePing alert portal; CA confirms internal research use with attribution."
set_research eu_access2markets \
  "EU Access2Markets open portal (ES); CA confirms internal research use."
set_research un_wpp \
  "UN World Population Prospects public data; CA confirms internal research use."

echo "research-use-confirm-extra-a: done (${DRY[*]:-write})"
