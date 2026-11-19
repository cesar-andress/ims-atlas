"""Polite HTTP helpers for ETL extract (retries, User-Agent, metadata)."""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import requests

USER_AGENT = "ims-atlas-etl/0.1 (+https://atlas.aiserv.es; research-etl; no PII)"


def fetch_bytes(
    url: str,
    *,
    timeout: float = 60.0,
    attempts: int = 4,
    sleep_base: float = 1.5,
) -> tuple[bytes, dict[str, str]]:
    """GET url with retries; return (body, response headers as str map)."""
    last_exc: Exception | None = None
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "*/*"})
    for attempt in range(1, attempts + 1):
        try:
            response = session.get(url, timeout=timeout)
            response.raise_for_status()
            headers = {str(k): str(v) for k, v in response.headers.items()}
            return response.content, headers
        except (requests.RequestException, OSError) as exc:
            last_exc = exc
            if attempt == attempts:
                break
            time.sleep(min(20.0, sleep_base**attempt))
    assert last_exc is not None
    raise RuntimeError(f"GET failed for {url!r}: {last_exc}") from last_exc


def write_artifact(
    dest: Path,
    body: bytes,
    *,
    url: str,
    headers: dict[str, str],
    extra_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Write body + sidecar JSON with sha256, url, headers, timing."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    digest = hashlib.sha256(body).hexdigest()
    meta = {
        "url": url,
        "sha256": digest,
        "bytes": len(body),
        "headers": headers,
        **(extra_meta or {}),
    }
    meta_path = dest.with_suffix(dest.suffix + ".meta.json")
    meta_path.write_text(
        json.dumps(meta, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return meta
