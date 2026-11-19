"""Locate pinned ims-backtest (imsfe) checkout files without guessing tags."""

from __future__ import annotations

import json
from importlib.metadata import PackageNotFoundError, distribution
from pathlib import Path


def resolve_imsfe_variables_yaml() -> Path:
    """Return config/variables.yaml from the pinned imsfe git checkout.

    imsfe wheels do not ship config/; uv keeps the git checkout under
    ~/.cache/uv/git-v0/checkouts keyed by the direct_url commit.
    """
    try:
        dist = distribution("imsfe")
    except PackageNotFoundError as exc:
        raise FileNotFoundError(
            "imsfe is not installed; run: uv sync --extra backtest",
        ) from exc

    raw = dist.read_text("direct_url.json")
    if raw is None:
        raise FileNotFoundError("imsfe has no direct_url.json metadata")
    info = json.loads(raw)
    commit = info.get("vcs_info", {}).get("commit_id", "")
    if len(commit) < 7:
        raise FileNotFoundError("imsfe direct_url.json missing commit_id")
    short = commit[:7]

    cache = Path.home() / ".cache/uv/git-v0/checkouts"
    matches = sorted(cache.glob(f"*/{short}/config/variables.yaml"))
    matches += sorted(cache.glob(f"*/{commit}/config/variables.yaml"))
    # Deduplicate while preserving order.
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in matches:
        resolved = path.resolve()
        if resolved not in seen and path.is_file():
            seen.add(resolved)
            unique.append(resolved)
    if not unique:
        raise FileNotFoundError(
            f"No uv git checkout for imsfe@{short} with config/variables.yaml "
            f"under {cache}",
        )
    return unique[0]
