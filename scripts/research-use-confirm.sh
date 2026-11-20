#!/usr/bin/env bash
# EXTRA-11 — César-only: set use_research=yes for sources whose terms are silent
# or inaccessible (not the “terms forbid extraction” group).
#
#   BY=CA scripts/research-use-confirm.sh --dry-run   # agents may run this
#   BY=CA scripts/research-use-confirm.sh             # César only; writes YAML
#
# Do NOT include: indexmundi, world_population_review, geodatos, searates,
# procolombia, heritage_ief, eiu_democracy, coface_country_risk (forbid / local_only).
set -euo pipefail
: "${BY:?set BY to your name or initials, e.g. BY=CA}"
cd "$(dirname "$0")/../etl"

DRY=()
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY=(--dry-run)
fi

set_research() {
  local id="$1"
  local note="$2"
  uv run atlas-etl rights-set "$id" \
    --by "$BY" \
    --use-research yes \
    --basis public_terms \
    --note "$note" \
    "${DRY[@]}"
}

# Silent / inaccessible terms → César confirms research use after reading the page.
set_research gedi \
  "Landing terms silent on bulk reuse; CA confirms internal research use only (EXTRA-11)."
set_research freight_manual \
  "Workbook freight refs; CA confirms internal research use of already-held figures (EXTRA-11)."
set_research preciosmundi \
  "Terms not clearly published; CA confirms internal research use only (EXTRA-11)."
set_research sea_distances \
  "Terms silent; CA confirms internal research use of distance tables (EXTRA-11)."
set_research nauticalculator \
  "Terms silent; CA confirms internal research use only (EXTRA-11)."
set_research knoema \
  "Aggregator terms unclear; CA confirms internal research use only (EXTRA-11)."
set_research theglobaleconomy \
  "Terms unclear; CA confirms internal research use only (EXTRA-11)."
set_research ef_epi \
  "EPI FAQ silent on bulk download; CA confirms internal research use of manual drop (EXTRA-11)."
set_research startupblink \
  "T&Cs proprietary; CA confirms internal research use of manual drop only (EXTRA-11)."
set_research global_product_prices \
  "Terms page incomplete; CA confirms internal research use only (EXTRA-11)."

echo "research-use-confirm: done (${DRY[*]:-write})"
