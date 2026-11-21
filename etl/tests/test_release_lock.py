"""Exclusive release lock: nestable, blocks concurrent holders."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from imsatlas_etl.pipeline import release_lock as rl
from imsatlas_etl.pipeline.release_lock import (
    release_exclusive_lock,
    release_lock_path,
)


@pytest.fixture(autouse=True)
def _reset_lock_state() -> None:
    """Ensure thread-local lock state is clean around each test."""
    assert rl._depth() == 0  # noqa: SLF001
    assert rl._lock_fp() is None  # noqa: SLF001
    yield
    assert rl._depth() == 0  # noqa: SLF001
    assert rl._lock_fp() is None  # noqa: SLF001


def test_release_lock_nests_same_thread(tmp_path: Path) -> None:
    path = release_lock_path(root=tmp_path)
    with release_exclusive_lock(root=tmp_path) as outer:
        assert outer == path
        assert path.is_file()
        with release_exclusive_lock(root=tmp_path) as inner:
            assert inner == path
            assert "pid=" in path.read_text(encoding="utf-8")
    assert rl._depth() == 0  # noqa: SLF001


def test_release_lock_nonblock_raises_when_held(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ATLAS_RELEASE_LOCK_NB", "1")
    barrier_held = False

    def other_thread() -> None:
        nonlocal barrier_held
        with pytest.raises(TimeoutError, match="release lock busy"):
            with release_exclusive_lock(root=tmp_path):
                pass
        barrier_held = True

    with release_exclusive_lock(root=tmp_path):
        with ThreadPoolExecutor(max_workers=1) as pool:
            fut = pool.submit(other_thread)
            fut.result(timeout=5)
    assert barrier_held
    monkeypatch.delenv("ATLAS_RELEASE_LOCK_NB", raising=False)


def test_release_lock_serializes_threads(tmp_path: Path) -> None:
    """Two threads cannot hold the exclusive lock at the same time."""
    order: list[str] = []

    def worker(label: str) -> None:
        with release_exclusive_lock(root=tmp_path):
            order.append(f"{label}:in")
            os.sched_yield()
            order.append(f"{label}:out")

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker, "a"), pool.submit(worker, "b")]
        for fut in futures:
            fut.result(timeout=5)

    assert order in (
        ["a:in", "a:out", "b:in", "b:out"],
        ["b:in", "b:out", "a:in", "a:out"],
    )
