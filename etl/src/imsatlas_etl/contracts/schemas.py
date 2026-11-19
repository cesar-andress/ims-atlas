"""Pandera data contracts for raw pipeline tables."""

from __future__ import annotations

import pandera.pandas as pa
from pandera.pandas import Check, Column, DataFrameSchema

ISO3 = Column(str, checks=Check.str_length(3, 3), nullable=False)
YEAR = Column(int, checks=Check.ge(1990), nullable=False)

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
        "distw": Column(float, checks=Check.gt(0), nullable=False, coerce=True),
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

RAW_CONTRACTS: dict[str, pa.DataFrameSchema] = {
    "worldbank_wdi": indicators_schema,
    "worldbank_wgi": indicators_schema,
    "worldbank_lpi": indicators_schema,
    "baci": trade_schema,
    "cepi_gravity": bilateral_schema,
    "hofstede": hofstede_schema,
    "wits_trains": tariffs_schema,
}
