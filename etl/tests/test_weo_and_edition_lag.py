"""IMF WEO mapping + EPI/GII edition→data year lag constants."""

from __future__ import annotations

from imsatlas_etl.pipeline.variables_build import INDEX_EDITION_LAG, WEO_CODE_TO_VAR


def test_weo_codes_cover_core_indicators() -> None:
    assert set(WEO_CODE_TO_VAR) >= {
        "NGDP_RPCH",
        "PCPIPCH",
        "NGDPDPC",
        "BCA_NGDPD",
        "LUR",
    }


def test_edition_lag_for_epi_and_gii() -> None:
    assert INDEX_EDITION_LAG["yale_epi"] == 2
    assert INDEX_EDITION_LAG["wipo_gii"] == 1
    # EPI 2026 edition → 2024 data year for LOCF against analysis year 2024.
    assert 2026 - INDEX_EDITION_LAG["yale_epi"] == 2024
    assert 2025 - INDEX_EDITION_LAG["wipo_gii"] == 2024
