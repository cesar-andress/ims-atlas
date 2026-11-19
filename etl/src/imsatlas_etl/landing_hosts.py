"""Explicit per-source allow-list for landing_url hosts (Phase L)."""

from __future__ import annotations

from urllib.parse import urlparse

# Hostnames that may appear in catalog/sources.yaml landing_url for each source.
# Keep this map in lockstep with sources.yaml — the test fails on drift.
LANDING_HOST_ALLOWLIST: dict[str, frozenset[str]] = {
    "worldbank_wdi": frozenset({"databank.worldbank.org"}),
    "worldbank_wgi": frozenset({"www.worldbank.org"}),
    "worldbank_lpi": frozenset({"lpi.worldbank.org"}),
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
