#!/usr/bin/env bash
# Human attestation of source rights (SPEC §10.2). Run from the repo root:
#   BY=CA scripts/rights-confirm.sh            # attest the "ready" group
# Each line fetches the terms page, stores its SHA-256 snapshot and records basis/scope.
# Flags (yes/no) were pre-filled from the live terms pages on 2026-11-20; read the
# evidence.note of each source in catalog/sources.yaml before running.
# Sources NOT listed here still have unknown flags or unreadable terms: see the end.
set -euo pipefail
: "${BY:?set BY to your name or initials, e.g. BY=CA}"
cd "$(dirname "$0")/../etl"

# verify <id> <scope>: skip if already attested; if the terms site blocks automated
# downloads (e.g. HTTP 403), record the attestation without a snapshot (sha256=nofetch).
verify() {
  local id="$1" scope="$2"
  if uv run python -c "import sys,yaml; d=yaml.safe_load(open('../catalog/sources.yaml')); s=[x for x in d['sources'] if x['id']==sys.argv[1]][0]; sys.exit(0 if s['rights']['evidence'].get('checked_by') else 1)" "$id"; then
    echo "skip $id (already attested)"; return
  fi
  if ! uv run atlas-etl rights-verify "$id" --by "$BY" --basis public_terms --scope "$scope"; then
    echo "  -> $id: terms page blocked automated download; attesting without snapshot"
    uv run atlas-etl rights-verify "$id" --by "$BY" --basis public_terms --scope "$scope" --no-fetch
  fi
}

verify worldbank_wdi redistribute_raw  # CC-BY-4.0, confidence high
verify worldbank_wgi redistribute_raw  # CC-BY-4.0, confidence medium
verify worldbank_lpi redistribute_raw  # CC-BY-4.0, confidence high
verify baci redistribute_raw  # etalab-2.0, confidence high
verify cepi_gravity redistribute_raw  # etalab-2.0, confidence high
verify wipo_gii redistribute_raw  # CC-BY-4.0, confidence medium
verify yale_epi redistribute_raw  # CC-BY-NC-SA-4.0, confidence medium
verify fragile_states_index redistribute_raw  # CC-BY-NC-SA-4.0, confidence medium
verify inform_risk redistribute_raw  # CC-BY-4.0, confidence medium
verify transparency_cpi redistribute_raw  # CC-BY-4.0, confidence medium
verify global_trade_alert use  # custom, confidence medium
verify worldbank_doing_business redistribute_raw  # CC-BY-4.0, confidence high
verify imf_weo redistribute_raw  # custom, confidence high
verify wto_tariffs redistribute_derived  # custom, confidence high
verify numbeo use  # proprietary, confidence high
verify solability_gsci redistribute_raw  # CC-BY-NC-SA-4.0, confidence medium
verify trade_barrier_index use  # proprietary, confidence high
verify unctadstat redistribute_raw  # CC-BY-3.0-IGO, confidence medium
verify literature_dyo redistribute_raw  # CC-BY-NC-SA-4.0, confidence medium

# Needs a person (terms unreadable, silent, or flags unknown) — do not attest blindly:
#   wits_trains  (custom, confidence medium)
#   hofstede  (custom, confidence medium)
#   itu_datahub  (CC-BY-NC-SA-3.0-IGO, confidence medium)
#   ef_epi  (proprietary, confidence low)
#   odin  (CC-BY-4.0, confidence medium)
#   gedi  (unknown, confidence low)
#   startupblink  (proprietary, confidence low)
#   heritage_ief  (proprietary, confidence low)
#   eiu_democracy  (proprietary, confidence low)
#   kof_globalisation  (custom, confidence medium)
#   freight_manual  (unknown, confidence low)
#   wto_itip  (custom, confidence medium)
#   preciosmundi  (unknown, confidence low)
#   global_product_prices  (unknown, confidence medium)
#   sea_distances  (unknown, confidence low)
#   searates  (proprietary, confidence medium)
#   nauticalculator  (unknown, confidence medium)
#   coface_country_risk  (proprietary, confidence high)
#   global_carbon_atlas  (custom, confidence medium)
#   iea_ghg  (proprietary, confidence low)
#   world_population_review  (proprietary, confidence high)
#   itc_trade  (custom, confidence low)
#   itc_trademap  (custom, confidence medium)
#   culture_factor  (proprietary, confidence medium)
#   indexmundi  (proprietary, confidence high)
#   knoema  (unknown, confidence low)
#   theglobaleconomy  (unknown, confidence medium)
#   geodatos  (proprietary, confidence high)
#   procolombia  (proprietary, confidence high)
#   iso_country_codes_ref  (custom, confidence medium)

uv run atlas-etl rights-report
echo "Done. Review catalog/RIGHTS.md, then commit catalog/."
