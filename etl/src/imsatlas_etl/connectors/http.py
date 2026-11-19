"""Polite HTTP helpers for ETL extract (retries, User-Agent, metadata)."""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

USER_AGENT = "ims-atlas-etl/0.1 (+https://atlas.aiserv.es; research-etl; no PII)"

# Transient statuses worth retrying with backoff.
RETRY_STATUSES: frozenset[int] = frozenset({429, 500, 502, 503, 504})

Sleeper = Callable[[float], None]


class SourceUnavailableError(RuntimeError):
    """Upstream could not be reached or required manual input is missing.

    The CLI maps this to exit code 2 (distinct from a QA block, exit code 1).
    """


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: bytes
    headers: dict[str, str]


def backoff_delay(
    attempt: int,
    *,
    sleep_base: float = 1.5,
    max_sleep: float = 30.0,
    retry_after: str | None = None,
) -> float:
    """Exponential backoff (base * 2**(attempt-1)); numeric Retry-After wins."""
    if retry_after is not None:
        try:
            return min(max_sleep, max(0.0, float(retry_after)))
        except ValueError:
            pass
    return min(max_sleep, sleep_base * (2 ** (attempt - 1)))


def fetch_response(
    url: str,
    *,
    timeout: float = 60.0,
    attempts: int = 4,
    sleep_base: float = 1.5,
    max_sleep: float = 30.0,
    ok_statuses: frozenset[int] = frozenset({200}),
    retry_statuses: frozenset[int] = RETRY_STATUSES,
    sleep: Sleeper = time.sleep,
    session: requests.Session | None = None,
) -> HttpResponse:
    """GET url with exponential backoff; return the first non-retryable response.

    Statuses in ``ok_statuses`` are returned. Statuses in ``retry_statuses`` are
    retried; any other status (or exhausted retries) raises
    ``SourceUnavailableError``.
    """
    sess = session or requests.Session()
    sess.headers.update({"User-Agent": USER_AGENT, "Accept": "*/*"})
    last_error = "no attempt made"
    for attempt in range(1, attempts + 1):
        retry_after: str | None = None
        try:
            response = sess.get(url, timeout=timeout)
            headers = {str(k): str(v) for k, v in response.headers.items()}
            if response.status_code in ok_statuses:
                return HttpResponse(response.status_code, response.content, headers)
            last_error = f"HTTP {response.status_code}"
            if response.status_code not in retry_statuses:
                break
            retry_after = headers.get("Retry-After")
        except (requests.RequestException, OSError) as exc:
            last_error = str(exc)
        if attempt == attempts:
            break
        sleep(
            backoff_delay(
                attempt,
                sleep_base=sleep_base,
                max_sleep=max_sleep,
                retry_after=retry_after,
            )
        )
    raise SourceUnavailableError(f"GET failed for {url!r}: {last_error}")


def fetch_bytes(
    url: str,
    *,
    timeout: float = 60.0,
    attempts: int = 4,
    sleep_base: float = 1.5,
    sleep: Sleeper = time.sleep,
) -> tuple[bytes, dict[str, str]]:
    """GET url with retries; return (body, response headers as str map)."""
    response = fetch_response(
        url,
        timeout=timeout,
        attempts=attempts,
        sleep_base=sleep_base,
        sleep=sleep,
    )
    return response.body, response.headers


def sha256_file(path: Path, *, chunk: int = 1 << 20) -> str:
    """Streaming SHA-256 of a file (safe for multi-GB archives)."""
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while block := fh.read(chunk):
            digest.update(block)
    return digest.hexdigest()


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


def write_file_meta(
    dest: Path,
    *,
    url: str,
    headers: dict[str, str] | None = None,
    extra_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Sidecar JSON for a file that was streamed to disk (not held in memory)."""
    meta = {
        "url": url,
        "sha256": sha256_file(dest),
        "bytes": dest.stat().st_size,
        "headers": headers or {},
        **(extra_meta or {}),
    }
    meta_path = dest.with_suffix(dest.suffix + ".meta.json")
    meta_path.write_text(
        json.dumps(meta, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return meta
