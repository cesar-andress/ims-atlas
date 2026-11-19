"""ABIERTO / CERRADO access mode and dual-store assignment (SPEC §13)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from imsatlas_etl.gate import evidence_present
from imsatlas_etl.paths import repo_root
from imsatlas_etl.rights import load_deployment

AccessMode = Literal["ABIERTO", "CERRADO"]
StoreKind = Literal["abierta", "cerrada"]

_ACCESS_RANK: dict[StoreKind, int] = {"abierta": 0, "cerrada": 1}


def parse_access_mode(
    value: str | None,
    *,
    default: AccessMode = "ABIERTO",
) -> AccessMode:
    if value is None or value == "":
        return default
    upper = str(value).strip().upper()
    if upper not in ("ABIERTO", "CERRADO"):
        raise ValueError(f"access_mode must be ABIERTO or CERRADO, got {value!r}")
    return upper  # type: ignore[return-value]


def access_mode_from_deployment(
    deployment: dict[str, Any] | None = None,
    *,
    root: Path | None = None,
    override: str | None = None,
) -> AccessMode:
    if override is not None:
        return parse_access_mode(override)
    if deployment is not None:
        data = deployment
    else:
        from imsatlas_etl.paths import deployment_yaml_path

        path = deployment_yaml_path()
        if root is not None:
            candidate = root / "config" / "deployment.yaml"
            if candidate.is_file():
                path = candidate
        try:
            data = load_deployment(path)
        except FileNotFoundError:
            return "CERRADO"
    return parse_access_mode(data.get("access_mode"), default="CERRADO")


def source_store(rights: dict[str, Any] | None) -> StoreKind:
    """
    Derive store from a source rights record (human input, never guessed).

    abierta only when redistribute_raw or redistribute_derived is yes AND
    evidence is present. Missing rights or any other case -> cerrada.
    """
    if not isinstance(rights, dict):
        return "cerrada"
    if not evidence_present(rights):
        return "cerrada"
    raw = rights.get("redistribute_raw")
    derived = rights.get("redistribute_derived")
    if raw == "yes" or derived == "yes":
        return "abierta"
    return "cerrada"


def source_store_reason(rights: dict[str, Any] | None) -> str:
    if not isinstance(rights, dict):
        return "no rights record"
    if not evidence_present(rights):
        return "rights evidence incomplete or missing"
    raw = rights.get("redistribute_raw")
    derived = rights.get("redistribute_derived")
    if raw == "yes":
        return "redistribute_raw=yes"
    if derived == "yes":
        return "redistribute_derived=yes"
    return f"redistribute_raw={raw!r}, redistribute_derived={derived!r}"


def taint(*stores: StoreKind | None) -> StoreKind:
    """Most restrictive input wins: any cerrada -> cerrada."""
    rank = 0
    for store in stores:
        if store is None:
            continue
        rank = max(rank, _ACCESS_RANK[store])
    return "cerrada" if rank >= 1 else "abierta"


def filter_sources_for_mode(
    sources: list[dict[str, Any]],
    mode: AccessMode,
) -> list[dict[str, Any]]:
    """ABIERTO: abierta sources only. CERRADO: all sources."""
    if mode == "CERRADO":
        return list(sources)
    return [s for s in sources if source_store(s.get("rights")) == "abierta"]


def store_root(kind: StoreKind, *, root: Path | None = None) -> Path:
    return (root or repo_root()) / "data" / "store" / kind


def store_manifest_path(kind: StoreKind, *, root: Path | None = None) -> Path:
    return store_root(kind, root=root) / "manifest.json"
