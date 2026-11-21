"""Pandera data contracts for raw pipeline tables."""

from __future__ import annotations

import pandera.pandas as pa
from pandera.pandas import Check, Column, DataFrameSchema

# Earliest year accepted by raw contracts; live connectors filter (and count) below.
MIN_YEAR = 1990

ISO3 = Column(str, checks=Check.str_length(3, 3), nullable=False)
YEAR = Column(int, checks=Check.ge(MIN_YEAR), nullable=False)

indicators_schema = DataFrameSchema(
    {
        "iso3": ISO3,
        "year": YEAR,
        "indicator": Column(str, nullable=False),
        "value": Column(float, nullable=True, coerce=True),
    },
    strict=True,
    coerce=True,
)

trade_schema = DataFrameSchema(
    {
        "year": YEAR,
        "exporter": ISO3,
        "importer": ISO3,
        "hs6": Column(str, checks=Check.str_length(6, 6), nullable=False),
        "value_usd": Column(float, checks=Check.ge(0), nullable=False, coerce=True),
        "quantity": Column(float, checks=Check.ge(0), nullable=True, coerce=True),
        "hs4": Column(str, checks=Check.str_length(4, 4), nullable=False),
        "hs2": Column(str, checks=Check.str_length(2, 2), nullable=False),
    },
    strict=True,
    coerce=True,
)

bilateral_schema = DataFrameSchema(
    {
        "origin": ISO3,
        "destination": ISO3,
        "year": YEAR,
        # CEPII Gravity occasionally records 0 for degenerate pairs; keep >= 0.
        "distw": Column(float, checks=Check.ge(0), nullable=False, coerce=True),
        "comlang_off": Column(int, checks=Check.isin([0, 1]), nullable=False),
        "fta_wto": Column(int, checks=Check.isin([0, 1]), nullable=False),
    },
    strict=True,
    coerce=True,
)

hofstede_schema = DataFrameSchema(
    {
        "iso3": ISO3,
        "pdi": Column(float, nullable=True, coerce=True),
        "idv": Column(float, nullable=True, coerce=True),
        "mas": Column(float, nullable=True, coerce=True),
        "uai": Column(float, nullable=True, coerce=True),
        "ltowvs": Column(float, nullable=True, coerce=True),
        "ivr": Column(float, nullable=True, coerce=True),
    },
    strict=True,
    coerce=True,
)

tariffs_schema = DataFrameSchema(
    {
        "year": YEAR,
        "origin": ISO3,
        "destination": ISO3,
        "hs6": Column(str, checks=Check.str_length(6, 6), nullable=False),
        "ahs": Column(float, checks=Check.ge(0), nullable=False, coerce=True),
    },
    strict=True,
    coerce=True,
)

# After ISO3 mapping; raw CSV may still carry country_name (validated in loader).
index_values_schema = DataFrameSchema(
    {
        "iso3": ISO3,
        "year": YEAR,
        "value": Column(float, nullable=True, coerce=True),
    },
    strict=True,
    coerce=True,
)

RAW_CONTRACTS: dict[str, pa.DataFrameSchema] = {
    "worldbank_wdi": indicators_schema,
    "worldbank_wgi": indicators_schema,
    "worldbank_lpi": indicators_schema,
    "baci": trade_schema,
    "cepi_gravity": bilateral_schema,
    "hofstede": hofstede_schema,
    "wits_trains": tariffs_schema,
    "itu_datahub": index_values_schema,
    "ef_epi": index_values_schema,
    "odin": index_values_schema,
    "gedi": index_values_schema,
    "wipo_gii": index_values_schema,
    "startupblink": index_values_schema,
    "yale_epi": index_values_schema,
    "inform_risk": index_values_schema,
    "transparency_cpi": index_values_schema,
    "worldbank_doing_business": indicators_schema,
    "unctadstat": indicators_schema,
    "imf_weo": indicators_schema,
}
