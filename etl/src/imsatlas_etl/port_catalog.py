"""Port ims-backtest variables.yaml into SPEC §4 catalog shape (+ draft vars)."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml

from imsatlas_etl.backtest_paths import resolve_imsfe_variables_yaml
from imsatlas_etl.paths import catalog_yaml_path

FACTOR_MAP = {"openness_legacy": "openness"}

# Spanish display names for the 18 ported ids (UI only; semantics from EN source).
NAME_ES: dict[str, str] = {
    "IMPV": "Importaciones del capítulo HS (USD)",
    "IMPC": "Importaciones del capítulo HS per cápita",
    "GRW": "Crecimiento de importaciones del capítulo HS (CAGR 3 años)",
    "GDPPC": "PIB per cápita PPA",
    "DIST": "Distancia ponderada por población",
    "TARIF": "Arancel preferencial aplicado (AHS), origen a destino",
    "FTA": "Acuerdo comercial preferencial en vigor",
    "LPI": "Índice de desempeño logístico (global)",
    "ASIASH": "Cuota China+Vietnam en importaciones HS del destino",
    "HHI": "Concentración de proveedores (HHI) en importaciones HS",
    "UVGAP": "Brecha absoluta de valor unitario en log",
    "CULT": "Distancia cultural (Kogut-Singh, Hofstede 6 dimensiones)",
    "LANG": "Idioma oficial común",
    "INFL": "Inflación anual (IPC)",
    "UNEMP": "Tasa de desempleo",
    "GOV": "Media de Worldwide Governance Indicators",
    "EOC": "Coeficiente de apertura externa (comercio/PIB)",
    "REEXP": "Intensidad de reexportación (capítulo X_j / M_j)",
}


SOURCE_IDS: dict[str, list[str]] = {
    "IMPV": ["baci"],
    "IMPC": ["baci", "worldbank_wdi"],
    "GRW": ["baci"],
    "GDPPC": ["worldbank_wdi"],
    "DIST": ["cepi_gravity"],
    "TARIF": ["wits_trains"],
    "FTA": ["cepi_gravity"],
    "LPI": ["worldbank_lpi"],
    "ASIASH": ["baci"],
    "HHI": ["baci"],
    "UVGAP": ["baci"],
    "CULT": ["hofstede"],
    "LANG": ["cepi_gravity"],
    "INFL": ["worldbank_wdi"],
    "UNEMP": ["worldbank_wdi"],
    "GOV": ["worldbank_wgi"],
    "EOC": ["worldbank_wdi"],
    "REEXP": ["baci"],
    "ITU_IDI": ["itu_datahub"],
    "EF_EPI": ["ef_epi"],
    "ODIN": ["odin"],
    "GEDI": ["gedi"],
    "GII": ["wipo_gii"],
    "STARTUPBLINK": ["startupblink"],
    "EPI": ["yale_epi"],
    "CO2PC": ["worldbank_wdi"],
    "PLI": ["worldbank_wdi"],
}

PRODUCT_IDS = frozenset(
    {"IMPV", "IMPC", "GRW", "ASIASH", "HHI", "UVGAP", "REEXP", "TARIF"},
)

# Licence / URL enrichment verified against official pages in Phase 1 research.
# Never mark redistributable true without a confirmed open licence.
SOURCE_META: dict[str, dict[str, Any]] = {
    "IMPV": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
        "citation": (
            "Gaulier, G. and Zignago, S. (2010). BACI: International Trade Database "
            "at the Product-Level. The 1994-2007 Version. CEPII Working Paper 2010-23."
        ),
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "IMPC": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
        "citation": (
            "BACI (CEPII) import values combined with World Bank population "
            "(SP.POP.TOTL). BACI: Gaulier & Zignago (2010); WDI: World Bank."
        ),
        "licence": "Etalab-2.0; CC-BY-4.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "GRW": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
        "citation": (
            "Derived from CEPII BACI (Gaulier & Zignago, 2010), HS chapter imports."
        ),
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "GDPPC": {
        "source_url": "https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD",
        "citation": "World Bank. World Development Indicators. NY.GDP.PCAP.PP.KD.",
        "licence": "CC-BY-4.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "DIST": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=8",
        "citation": (
            "Conte, M., Cotterlaz, P. and Mayer, T. (2022). "
            "The CEPII Gravity database. CEPII Working Paper 2022-05."
        ),
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "irregular",
    },
    "TARIF": {
        "source_url": "https://wits.worldbank.org/",
        "citation": (
            "World Bank / UNCTAD WITS-TRAINS applied preferential tariff (AHS)."
        ),
        "licence": "UNKNOWN",
        "redistributable": False,
        "frequency": "annual",
        "notes_extra": (
            "WITS/TRAINS redistribution terms not confirmed from an openable "
            "official licence page in Phase 1; BYOD until verified."
        ),
    },
    "FTA": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=8",
        "citation": (
            "Conte, M., Cotterlaz, P. and Mayer, T. (2022). "
            "The CEPII Gravity database. CEPII Working Paper 2022-05."
        ),
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "LPI": {
        "source_url": "https://data.worldbank.org/indicator/LP.LPI.OVRL.XQ",
        "citation": "World Bank. Logistics Performance Index. LP.LPI.OVRL.XQ.",
        "licence": "CC-BY-4.0",
        "redistributable": True,
        "frequency": "irregular",
    },
    "ASIASH": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
        "citation": "Derived from CEPII BACI (Gaulier & Zignago, 2010).",
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "HHI": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
        "citation": "Derived from CEPII BACI (Gaulier & Zignago, 2010).",
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "UVGAP": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
        "citation": "Derived from CEPII BACI (Gaulier & Zignago, 2010).",
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "CULT": {
        "source_url": "https://geerthofstede.com/research-and-vsm/dimension-data-matrix/",
        "citation": (
            "Hofstede dimension scores (6 dimensions). geerthofstede.com dimension "
            "data matrix; cultural distance via Kogut-Singh."
        ),
        "licence": "UNKNOWN",
        "redistributable": False,
        "frequency": "irregular",
        "notes_extra": (
            "ims-backtest README: Hofstede raw data is not redistributed; researchers "
            "may use the published matrix, commercial use requires contacting authors."
        ),
    },
    "LANG": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=8",
        "citation": (
            "Conte, M., Cotterlaz, P. and Mayer, T. (2022). "
            "The CEPII Gravity database. CEPII Working Paper 2022-05."
        ),
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "irregular",
    },
    "INFL": {
        "source_url": "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
        "citation": "World Bank. World Development Indicators. FP.CPI.TOTL.ZG.",
        "licence": "CC-BY-4.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "UNEMP": {
        "source_url": "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS",
        "citation": "World Bank. World Development Indicators. SL.UEM.TOTL.ZS.",
        "licence": "CC-BY-4.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "GOV": {
        "source_url": "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
        "citation": (
            "World Bank. Worldwide Governance Indicators (mean of six estimate series)."
        ),
        "licence": "CC-BY-4.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "EOC": {
        "source_url": "https://data.worldbank.org/indicator/NE.TRD.GNFS.ZS",
        "citation": "World Bank. World Development Indicators. NE.TRD.GNFS.ZS.",
        "licence": "CC-BY-4.0",
        "redistributable": True,
        "frequency": "annual",
    },
    "REEXP": {
        "source_url": "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
        "citation": "Derived from CEPII BACI (Gaulier & Zignago, 2010).",
        "licence": "Etalab-2.0",
        "redistributable": True,
        "frequency": "annual",
    },
}

DEFAULT_YEARS = [2012, 2024]

ATLAS_FACTORS = [
    "demand",
    "cost_access",
    "logistics",
    "competition",
    "product_fit",
    "macro_risk",
    "institutional",
    "openness",
    "communication",
    "entrepreneurship",
    "sustainability",
    "promotion",
]


def infer_level(var_id: str, origin_specific: bool) -> str:
    if origin_specific and var_id in PRODUCT_IDS:
        return "bilateral_product"
    if origin_specific:
        return "bilateral"
    if var_id in PRODUCT_IDS:
        return "country_product"
    return "country"


def transform_backtest_variable(raw: dict[str, Any]) -> dict[str, Any]:
    var_id = str(raw["id"])
    meta = SOURCE_META[var_id]
    factor = FACTOR_MAP.get(str(raw["factor"]), str(raw["factor"]))
    origin_specific = bool(raw.get("origin_specific", False))
    notes = str(raw.get("notes") or "")
    extra = meta.get("notes_extra")
    if extra:
        notes = f"{notes} {extra}".strip() if notes else str(extra)

    out: dict[str, Any] = {
        "id": var_id,
        "name": {
            "en": str(raw["name"]),
            "es": NAME_ES[var_id],
        },
        "factor": factor,
        "level": infer_level(var_id, origin_specific),
        "direction": str(raw["direction"]),
        "transform": str(raw["transform"]),
        "unit": str(raw["unit"]),
        "source": str(raw["source"]),
        "source_ids": list(SOURCE_IDS[var_id]),
        "citation": meta["citation"],
        "redistributable": bool(meta["redistributable"]),
        "years": list(DEFAULT_YEARS),
        "frequency": meta["frequency"],
        "coverage_countries": None,
        "series_breaks": [],
        "notes": notes,
        "status": "draft",
        "code": str(raw.get("code", "")),
        "origin_specific": origin_specific,
    }
    if not out["redistributable"]:
        out["byod_only"] = True
    return out


def new_draft_variables() -> list[dict[str, Any]]:
    """SPEC §4 new/optional variables; licences only when officially confirmed."""
    drafts: list[dict[str, Any]] = [
        {
            "id": "ITU_IDI",
            "name": {
                "en": "ICT Development Index",
                "es": "Índice de desarrollo de las TIC",
            },
            "factor": "communication",
            "level": "country",
            "direction": "benefit",
            "transform": "none",
            "unit": "index",
            "source": "ITU",
            "source_ids": ["itu_datahub"],
            "citation": (
                "International Telecommunication Union. ICT Development Index / "
                "ITU DataHub."
            ),
            "redistributable": False,
            "byod_only": True,
            "years": [2023, 2026],
            "frequency": "annual",
            "coverage_countries": None,
            "series_breaks": [2023],
            "notes": (
                "ITU DataHub About page: CC BY-NC-SA 3.0 IGO (non-commercial). "
                "New IDI methodology from 2023 — do not splice with pre-2023 silently."
            ),
            "status": "draft",
        },
        {
            "id": "EF_EPI",
            "name": {
                "en": "EF English Proficiency Index",
                "es": "Índice de dominio del inglés EF",
            },
            "factor": "communication",
            "level": "country",
            "direction": "benefit",
            "transform": "none",
            "unit": "index",
            "source": "EF",
            "source_ids": ["ef_epi"],
            "citation": "EF Education First. EF English Proficiency Index.",
            "redistributable": False,
            "byod_only": True,
            "years": [2011, 2026],
            "frequency": "annual",
            "coverage_countries": None,
            "series_breaks": [],
            "notes": (
                "Official landing opened; redistribution / open-licence terms not "
                "stated clearly — treat as proprietary BYOD until verified."
            ),
            "status": "draft",
        },
        {
            "id": "ODIN",
            "name": {
                "en": "Open Data Inventory overall score",
                "es": "Puntuación global Open Data Inventory",
            },
            "factor": "communication",
            "level": "country",
            "direction": "benefit",
            "transform": "none",
            "unit": "index",
            "source": "Open Data Watch",
            "source_ids": ["odin"],
            "citation": "Open Data Watch. Open Data Inventory (ODIN).",
            "redistributable": False,
            "byod_only": True,
            "years": [2015, 2024],
            "frequency": "biennial",
            "coverage_countries": None,
            "series_breaks": [],
            "notes": (
                "Official site shows a CC BY icon; older ODIN reports cite CC BY 4.0. "
                "Current machine-readable download terms not confirmed this session — "
                "UNKNOWN until a human verifies the download licence."
            ),
            "status": "draft",
        },
        {
            "id": "GEDI",
            "name": {
                "en": "Global Entrepreneurship Index",
                "es": "Índice global de emprendimiento (GEDI)",
            },
            "factor": "entrepreneurship",
            "level": "country",
            "direction": "benefit",
            "transform": "none",
            "unit": "index",
            "source": "GEDI Institute",
            "source_ids": ["gedi"],
            "citation": "The GEDI Institute. Global Entrepreneurship Index (GEI).",
            "redistributable": False,
            "byod_only": True,
            "years": [2006, 2019],
            "frequency": "irregular",
            "coverage_countries": None,
            "series_breaks": [],
            "notes": (
                "Final GEI issue around 2019; no clear SPDX redistribution licence "
                "on the official pages opened — BYOD."
            ),
            "status": "draft",
        },
        {
            "id": "GII",
            "name": {
                "en": "Global Innovation Index",
                "es": "Índice global de innovación",
            },
            "factor": "entrepreneurship",
            "level": "country",
            "direction": "benefit",
            "transform": "none",
            "unit": "index",
            "source": "WIPO",
            "source_ids": ["wipo_gii"],
            "citation": (
                "World Intellectual Property Organization (WIPO). "
                "Global Innovation Index."
            ),
            "redistributable": True,
            "years": [2013, 2026],
            "frequency": "annual",
            "coverage_countries": None,
            "series_breaks": [],
            "notes": (
                "GII 2026 publication states CC BY 4.0; confirm the database file "
                "carries the same terms before status: verified."
            ),
            "status": "draft",
        },
        {
            "id": "STARTUPBLINK",
            "name": {
                "en": "Global Startup Ecosystem Index",
                "es": "Índice global de ecosistemas startup",
            },
            "factor": "entrepreneurship",
            "level": "country",
            "direction": "benefit",
            "transform": "none",
            "unit": "index",
            "source": "StartupBlink",
            "source_ids": ["startupblink"],
            "citation": "StartupBlink. Global Startup Ecosystem Index.",
            "redistributable": False,
            "byod_only": True,
            "years": [2020, 2026],
            "frequency": "annual",
            "coverage_countries": None,
            "series_breaks": [],
            "notes": "Likely proprietary; no open licence confirmed — BYOD.",
            "status": "draft",
        },
        {
            "id": "EPI",
            "name": {
                "en": "Environmental Performance Index",
                "es": "Índice de desempeño ambiental",
            },
            "factor": "sustainability",
            "level": "country",
            "direction": "benefit",
            "transform": "none",
            "unit": "index",
            "source": "Yale EPI",
            "source_ids": ["yale_epi"],
            "citation": (
                "Wendling, Z. A., Emerson, J. W., Esty, D. C., de Sherbinin, A., "
                "Block, S., et al. (2026). 2026 Environmental Performance Index. "
                "Yale Center for Environmental Law & Policy."
            ),
            "redistributable": False,
            "byod_only": True,
            "years": [2006, 2026],
            "frequency": "biennial",
            "coverage_countries": None,
            "series_breaks": [],
            "notes": (
                "epi.yale.edu downloads footer and FAQs: CC BY-NC-SA 4.0 — "
                "non-commercial; not shipped in the public release."
            ),
            "status": "draft",
        },
        {
            "id": "CO2PC",
            "name": {
                "en": "CO2 emissions excluding LULUCF per capita (t CO2e/capita)",
                "es": "Emisiones de CO2 excl. UTCUTS per cápita (t CO2e/cápita)",
            },
            "factor": "sustainability",
            "level": "country",
            "direction": "cost",
            "transform": "none",
            "unit": "t CO2e per capita",
            "source": "WB",
            "code": "EN.GHG.CO2.PC.CE.AR5",
            "source_ids": ["worldbank_wdi"],
            "citation": (
                "World Bank. World Development Indicators. EN.GHG.CO2.PC.CE.AR5 "
                "(CO2 emissions excluding LULUCF per capita)."
            ),
            "redistributable": True,
            "years": list(DEFAULT_YEARS),
            "frequency": "annual",
            "coverage_countries": None,
            "series_breaks": [2024],
            "notes": (
                "Replaces discontinued EN.ATM.CO2E.PC (WDI Database Archives). "
                "Different source/definition; do not splice with the archived series. "
                "series_breaks marks the catalog switch year (not an upstream splice)."
            ),
            "status": "draft",
        },
        {
            "id": "PLI",
            "name": {
                "en": "Price level index (households and NPISHs final consumption)",
                "es": "Índice de nivel de precios (consumo final hogares y NPSH)",
            },
            "factor": "cost_access",
            "level": "country",
            "direction": "cost",
            "transform": "none",
            "unit": "index (USA=100)",
            "source": "WB ICP/WDI",
            "source_ids": ["worldbank_wdi"],
            "citation": (
                "World Bank. World Development Indicators / ICP. PA.NUS.PRVT.PLI."
            ),
            "redistributable": True,
            "years": list(DEFAULT_YEARS),
            "frequency": "annual",
            "coverage_countries": None,
            "series_breaks": [],
            "notes": (
                "Open price-level replacement for scraped consumer-price baskets. "
                "Indicator page states CC BY-4.0."
            ),
            "status": "draft",
        },
    ]
    return drafts


def build_catalog_from_backtest(
    backtest_yaml: Path | None = None,
) -> dict[str, Any]:
    source = backtest_yaml or resolve_imsfe_variables_yaml()
    with source.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)
    if not isinstance(raw, dict) or "variables" not in raw:
        raise ValueError(f"{source}: expected mapping with variables list")

    ported: list[dict[str, Any]] = []
    for item in raw["variables"]:
        if not isinstance(item, dict):
            raise ValueError("backtest variable entry must be a mapping")
        ported.append(transform_backtest_variable(item))

    if len(ported) != 18:
        raise ValueError(f"expected 18 backtest variables, got {len(ported)}")

    return {
        "factors": list(ATLAS_FACTORS),
        "variables": ported + new_draft_variables(),
    }


def write_catalog_yaml(
    catalog: dict[str, Any] | None = None,
    *,
    path: Path | None = None,
) -> Path:
    data = catalog or build_catalog_from_backtest()
    target = path or catalog_yaml_path()
    header = (
        "# IMS Atlas variable catalog (SPEC §4).\n"
        "# Ported entries are transformed from pinned imsfe/ims-backtest "
        "config/variables.yaml (do not retype by hand).\n"
        "# New SPEC §4 variables are status: draft. Licence UNKNOWN => "
        "redistributable false / BYOD.\n"
        "# coverage_countries is filled by ETL later.\n"
    )
    payload = deepcopy(data)
    text = yaml.safe_dump(
        payload,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=100,
    )
    target.write_text(header + text, encoding="utf-8")
    return target
