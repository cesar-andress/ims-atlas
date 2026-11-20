"""IMF WEO connector — parse recorded SDMX CSV shape (no network)."""

from __future__ import annotations

from imsatlas_etl.connectors import imf_weo

SAMPLE = (
    b"STRUCTURE[;],STRUCTURE_ID,ACTION,COUNTRY,INDICATOR,"
    b"FREQUENCY,TIME_PERIOD,OBS_VALUE\n"
    b"dataflow,IMF.RES:WEO(9.0.0),R,COL,NGDP_RPCH,A,2023,0.6\n"
    b"dataflow,IMF.RES:WEO(9.0.0),R,COL,NGDP_RPCH,A,2024,1.7\n"
    b"dataflow,IMF.RES:WEO(9.0.0),R,USA,NGDP_RPCH,A,2023,2.5\n"
    b"dataflow,IMF.RES:WEO(9.0.0),R,W1,NGDP_RPCH,A,2023,1.0\n"
    b"dataflow,IMF.RES:WEO(9.0.0),R,COL,PCPIPCH,A,1989,999\n"
)


def test_parse_csv_keeps_iso3_and_min_year() -> None:
    frame = imf_weo._parse_csv(SAMPLE)
    assert set(frame.columns) == {"iso3", "year", "indicator", "value"}
    assert set(frame["iso3"]) == {"COL", "USA"}
    assert 1989 not in set(frame["year"])  # below MIN_YEAR
    assert len(frame) == 3
