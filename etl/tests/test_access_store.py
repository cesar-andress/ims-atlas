"""ABIERTO / CERRADO store assignment and taint (SPEC §13)."""

from __future__ import annotations

from imsatlas_etl.access import (
    parse_access_mode,
    source_store,
    source_store_reason,
    taint,
)
from imsatlas_etl.pipeline.stores import variable_store, write_stores


def _rights(**flags: object) -> dict:
    base = {
        "use_research": "yes",
        "redistribute_raw": "unknown",
        "redistribute_derived": "unknown",
        "commercial_use": "yes",
        "attribution_required": "yes",
        "share_alike": "no",
        "no_derivatives": "no",
        "evidence": {
            "checked_by": "CA",
            "checked_on": "2026-11-19",
            "terms_url": "https://example.org/terms",
            "snapshot_sha256": "a" * 64,
        },
    }
    base.update(flags)
    return base


def test_parse_access_mode() -> None:
    assert parse_access_mode(None, default="CERRADO") == "CERRADO"
    assert parse_access_mode("abierto") == "ABIERTO"
    assert parse_access_mode("CERRADO") == "CERRADO"


def test_source_store_requires_evidence_and_redistribute() -> None:
    assert source_store(None) == "cerrada"
    assert source_store({}) == "cerrada"
    assert source_store(_rights(redistribute_raw="yes")) == "abierta"
    assert source_store(_rights(redistribute_derived="yes")) == "abierta"
    assert source_store(_rights(redistribute_raw="no", redistribute_derived="no")) == (
        "cerrada"
    )
    no_ev = _rights(redistribute_raw="yes")
    no_ev["evidence"] = {}
    assert source_store(no_ev) == "cerrada"
    assert "evidence" in source_store_reason(no_ev)


def test_taint_most_restrictive() -> None:
    assert taint("abierta", "abierta") == "abierta"
    assert taint("abierta", "cerrada") == "cerrada"
    assert taint("cerrada") == "cerrada"
    assert taint() == "abierta"


def test_variable_store_taints_on_any_cerrada() -> None:
    registry = {
        "wb": {"rights": _rights(redistribute_raw="yes")},
        "hof": {"rights": _rights(redistribute_raw="no")},
    }
    assert variable_store({"id": "EOC", "source_ids": ["wb"]}, registry) == "abierta"
    assert (
        variable_store({"id": "CULT", "source_ids": ["wb", "hof"]}, registry)
        == "cerrada"
    )


def test_write_stores_empty_curated(tmp_path) -> None:
    (tmp_path / "data" / "curated").mkdir(parents=True)
    (tmp_path / "catalog").mkdir()
    (tmp_path / "catalog" / "sources.yaml").write_text(
        "schema_version: '1.0'\nsources: []\n",
        encoding="utf-8",
    )
    (tmp_path / "catalog" / "variables.yaml").write_text(
        "schema_version: '1.0'\nvariables: []\n",
        encoding="utf-8",
    )
    report = write_stores(root=tmp_path)
    assert report["stores"]["abierta"]["n_sources"] == 0
    assert report["stores"]["cerrada"]["n_sources"] == 0
    assert (tmp_path / "data" / "store" / "abierta" / "manifest.json").is_file()
    assert (tmp_path / "data" / "store" / "cerrada" / "manifest.json").is_file()
