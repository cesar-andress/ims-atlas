"""Serialize release / promote so concurrent ``--force`` cannot wipe mid-write.

Concurrent ``run_release(..., force=True)`` processes race on the same
staging tree: one ``rmtree`` between another's ``mkdir`` and ``to_parquet``
produces empty/partial ``country_product`` and a shrink-guard failure that
looks like bad data. A process-wide exclusive flock prevents that without
loosening the shrink guard.

Nesting is supported per thread (``release-dual`` calls ``run_release`` twice)
via a thread-local depth counter that keeps a single open lock fd.
"""

from __future__ import annotations

import os
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import TextIO

from imsatlas_etl.pipeline.io_paths import status_root

_LOCK_NAME = "release.lock"
_local = threading.local()


def release_lock_path(*, root: Path | None = None) -> Path:
    """Lock file under ``status/`` (writable in tests and on the host)."""
    return status_root(root=root) / _LOCK_NAME


def _depth() -> int:
    return int(getattr(_local, "depth", 0))


def _set_depth(value: int) -> None:
    _local.depth = value


def _lock_fp() -> TextIO[str] | None:
    return getattr(_local, "fp", None)


def _set_lock_fp(fp: TextIO[str] | None) -> None:
    _local.fp = fp


@contextmanager
def release_exclusive_lock(*, root: Path | None = None) -> Iterator[Path]:
    """Acquire an exclusive flock for the duration of a release/promote.

    Re-entrant in the same thread: nested callers share one fd. Other threads
    or processes block until the holder exits (or fail if
    ``ATLAS_RELEASE_LOCK_NB=1``).
    """
    path = release_lock_path(root=root)
    path.parent.mkdir(parents=True, exist_ok=True)

    if _depth() == 0:
        import fcntl

        fp = path.open("a+", encoding="utf-8")
        nonblock = os.environ.get("ATLAS_RELEASE_LOCK_NB", "").strip() in {
            "1",
            "true",
            "yes",
        }
        flags = fcntl.LOCK_EX | (fcntl.LOCK_NB if nonblock else 0)
        try:
            fcntl.flock(fp.fileno(), flags)
        except BlockingIOError as exc:
            fp.close()
            raise TimeoutError(
                f"release lock busy: {path} (another release/promote holds it)",
            ) from exc
        fp.seek(0)
        fp.truncate()
        fp.write(f"pid={os.getpid()} tid={threading.get_ident()}\n")
        fp.flush()
        _set_lock_fp(fp)

    _set_depth(_depth() + 1)
    try:
        yield path
    finally:
        _set_depth(_depth() - 1)
        if _depth() == 0:
            fp = _lock_fp()
            _set_lock_fp(None)
            if fp is not None:
                import fcntl

                try:
                    fcntl.flock(fp.fileno(), fcntl.LOCK_UN)
                finally:
                    fp.close()
