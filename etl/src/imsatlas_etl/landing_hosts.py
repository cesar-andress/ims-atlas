"""Explicit per-source allow-list for landing_url hosts (Phase L / A0)."""

from __future__ import annotations

from urllib.parse import urlparse

# Hostnames that may appear in catalog/sources.yaml landing_url for each source.
# Keep this map in lockstep with sources.yaml — the test fails on drift.
LANDING_HOST_ALLOWLIST: dict[str, frozenset[str]] = {
    "worldbank_wdi": frozenset({"databank.worldbank.org"}),
    "worldbank_wgi": frozenset({"www.worldbank.org"}),
    "worldbank_lpi": frozenset({"lpi.worldbank.org"}),
    "worldbank_doing_business": frozenset(
        {"archive.doingbusiness.org", "espanol.doingbusiness.org"},
    ),
    "baci": frozenset({"www.cepii.fr"}),
    "cepi_gravity": frozenset({"www.cepii.fr"}),
    "wits_trains": frozenset({"wits.worldbank.org"}),
    "hofstede": frozenset({"geerthofstede.com"}),
    "itu_datahub": frozenset({"datahub.itu.int"}),
    "ef_epi": frozenset({"www.ef.com"}),
    "odin": frozenset({"odin.opendatawatch.com"}),
    "gedi": frozenset({"thegedi.org"}),
    "wipo_gii": frozenset({"www.wipo.int"}),
    "startupblink": frozenset({"www.startupblink.com"}),
    "yale_epi": frozenset({"epi.yale.edu"}),
    "heritage_ief": frozenset({"www.heritage.org"}),
    "fragile_states_index": frozenset({"fragilestatesindex.org"}),
    "inform_risk": frozenset({"drmkc.jrc.ec.europa.eu"}),
    "eiu_democracy": frozenset({"www.eiu.com"}),
    "kof_globalisation": frozenset({"kof.ethz.ch"}),
    "transparency_cpi": frozenset({"www.transparency.org"}),
    "global_trade_alert": frozenset({"globaltradealert.org"}),
    "freight_manual": frozenset({"www.icontainers.com"}),
    # Phase A0 workbook publishers
    "imf_weo": frozenset({"www.imf.org"}),
    "wto_tariffs": frozenset({"ttd.wto.org", "tariffdata.wto.org"}),
    "wto_itip": frozenset({"i-tip.wto.org"}),
    "numbeo": frozenset({"www.numbeo.com"}),
    "preciosmundi": frozenset({"preciosmundi.com"}),
    "global_product_prices": frozenset({"www.globalproductprices.com"}),
    "sea_distances": frozenset({"sea-distances.org"}),
    "searates": frozenset({"www.searates.com"}),
    "nauticalculator": frozenset({"nauticalculator.com"}),
    "solability_gsci": frozenset({"solability.com"}),
    "coface_country_risk": frozenset({"www.coface.com"}),
    "global_carbon_atlas": frozenset({"globalcarbonatlas.org"}),
    "iea_ghg": frozenset({"www.iea.org"}),
    "trade_barrier_index": frozenset({"www.tradebarrierindex.org"}),
    "world_population_review": frozenset({"worldpopulationreview.com"}),
    "itc_trade": frozenset({"www.intracen.org"}),
    "itc_trademap": frozenset({"www.trademap.org"}),
    "unctadstat": frozenset({"unctadstat.unctad.org"}),
    "culture_factor": frozenset({"www.theculturefactor.com"}),
    "indexmundi": frozenset({"www.indexmundi.com"}),
    "knoema": frozenset({"knoema.es", "knoema.com"}),
    "theglobaleconomy": frozenset({"www.theglobaleconomy.com"}),
    "geodatos": frozenset({"www.geodatos.net"}),
    "procolombia": frozenset({"ruta-exportadora.procolombia.co", "procolombia.co"}),
    "iso_country_codes_ref": frozenset({"www.inapi.cl"}),
    "literature_dyo": frozenset({"www.revistadyo.es"}),
}


def landing_host(url: str) -> str:
    host = urlparse(url).hostname
    if not host:
        raise ValueError(f"landing_url has no hostname: {url!r}")
    return host.lower()


def check_landing_hosts(sources: list[dict]) -> list[str]:
    """Return validation error strings for landing_url host mismatches."""
    errors: list[str] = []
    seen: set[str] = set()
    for source in sources:
        if not isinstance(source, dict):
            continue
        sid = source.get("id")
        if not isinstance(sid, str):
            continue
        seen.add(sid)
        url = source.get("landing_url")
        if not isinstance(url, str) or not url.strip():
            errors.append(f"{sid}: missing landing_url")
            continue
        allowed = LANDING_HOST_ALLOWLIST.get(sid)
        if allowed is None:
            errors.append(f"{sid}: not in LANDING_HOST_ALLOWLIST")
            continue
        try:
            host = landing_host(url)
        except ValueError as exc:
            errors.append(f"{sid}: {exc}")
            continue
        if host not in allowed:
            errors.append(
                f"{sid}: landing host {host!r} not in allow-list {sorted(allowed)}",
            )
    for sid in sorted(LANDING_HOST_ALLOWLIST.keys() - seen):
        errors.append(f"{sid}: in LANDING_HOST_ALLOWLIST but missing from sources.yaml")
    return errors
