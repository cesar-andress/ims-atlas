from __future__ import annotations

from typer.testing import CliRunner

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.cli import app
from imsatlas_etl.gate import gate
from imsatlas_etl.paths import catalog_dir, deployment_yaml_path, rights_md_path
from imsatlas_etl.rights import gate_for_variable, load_deployment, render_rights_md
from imsatlas_etl.sources import assert_valid_sources, load_sources, sources_by_id

runner = CliRunner()


def test_sources_yaml_validates() -> None:
    data = load_sources()
    assert_valid_sources(data)
    assert len(data["sources"]) >= 10


def test_ef_epi_is_education_first_not_fraser() -> None:
    registry = sources_by_id()
    ef = registry["ef_epi"]
    assert ef["publisher"] == "EF Education First"
    assert "ef.com" in str(ef["landing_url"])
    assert "fraser" not in str(ef["landing_url"]).lower()
    assert "fraser" not in str(ef["citation"]).lower()


def test_each_source_landing_host_is_allowlisted() -> None:
    from urllib.parse import urlparse

    from imsatlas_etl.landing_hosts import LANDING_HOST_ALLOWLIST

    data = load_sources()
    assert_valid_sources(data)
    for source in data["sources"]:
        sid = source["id"]
        host = urlparse(source["landing_url"]).hostname
        assert host in LANDING_HOST_ALLOWLIST[sid], sid


def test_deployment_commercial_context_true() -> None:
    deploy = load_deployment()
    assert deployment_yaml_path().is_file()
    assert deploy["commercial_context"] is True


def test_every_variable_source_ids_resolve() -> None:
    registry = sources_by_id()
    catalog = load_catalog()
    for var in catalog["variables"]:
        for sid in var["source_ids"]:
            assert sid in registry


SHIP_RAW_SOURCES = frozenset(
    {
        "worldbank_wdi",
        "worldbank_wgi",
        "worldbank_lpi",
        "baci",
        "cepi_gravity",
        "wipo_gii",
        "inform_risk",
        "transparency_cpi",
        "worldbank_doing_business",
        "unctadstat",
    },
)


def test_source_gate_after_ca_attestation() -> None:
    """CA attested 19 sources on 2026-11-20; only open licences ship publicly."""
    from imsatlas_etl.gate import gate_one

    deploy = load_deployment()
    decisions = {
        sid: gate_one(src["rights"], None, deploy)["decision"]
        for sid, src in sources_by_id().items()
    }
    assert {s for s, d in decisions.items() if d == "ship_raw"} == SHIP_RAW_SOURCES
    assert decisions["coface_country_risk"] == "local_only"
    others = set(decisions) - SHIP_RAW_SOURCES - {"coface_country_risk"}
    assert all(decisions[s] == "byod_only" for s in others)


def test_catalog_variables_never_ship_from_unattested_sources() -> None:
    catalog = load_catalog()
    deploy = load_deployment()
    registry = sources_by_id()
    for var in catalog["variables"]:
        result = gate_for_variable(var, registry=registry, deployment=deploy)
        if result["decision"] in {"ship_raw", "ship_derived"}:
            assert set(var["source_ids"]) <= SHIP_RAW_SOURCES, var["id"]


def test_rights_report_cli(tmp_path) -> None:
    result = runner.invoke(app, ["rights-report"])
    assert result.exit_code == 0, result.output
    md = rights_md_path().read_text(encoding="utf-8")
    assert "| Source |" in md
    assert "Needs human rights check" in md
    assert "worldbank_wdi" in md
    text = render_rights_md()
    assert "byod_only" in text


def test_gate_most_restrictive_matches_shared_case() -> None:
    open_rights = {
        "licence_id": "CC-BY-4.0",
        "use_research": "yes",
        "redistribute_raw": "yes",
        "redistribute_derived": "yes",
        "commercial_use": "yes",
        "attribution_required": "yes",
        "share_alike": "no",
        "no_derivatives": "no",
        "evidence": {
            "checked_by": "Alice",
            "checked_on": "2026-11-19",
            "terms_url": "https://example.test/a",
            "snapshot_sha256": "a",
        },
    }
    unknown = {
        "licence_id": "UNKNOWN",
        "use_research": "unknown",
        "redistribute_raw": "unknown",
        "redistribute_derived": "unknown",
        "commercial_use": "unknown",
        "attribution_required": "unknown",
        "share_alike": "unknown",
        "no_derivatives": "unknown",
        "evidence": {
            "checked_by": None,
            "checked_on": None,
            "terms_url": "https://example.test/b",
            "snapshot_sha256": None,
        },
    }
    result = gate([open_rights, unknown], None, {"commercial_context": True})
    assert result["decision"] == "byod_only"


def test_sources_schema_file_exists() -> None:
    assert (catalog_dir() / "sources.schema.json").is_file()
    assert (catalog_dir() / "sources.yaml").is_file()
    assert (catalog_dir() / "gate_cases.json").is_file()
