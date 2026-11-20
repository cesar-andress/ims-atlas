from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from imsatlas_etl.cli import app
from imsatlas_etl.pipeline.integrity import (
    UNSIGNED_NOTE,
    parse_sha256sums,
    render_sha256sums,
    signature_block,
    verify_release,
)
from imsatlas_etl.pipeline.promote import promote_release
from imsatlas_etl.pipeline.release import run_release

runner = CliRunner()


def _tiny_release(tmp_path: Path) -> Path:
    rel = tmp_path / "v0.0.1"
    (rel / "sub=1").mkdir(parents=True)
    (rel / "a.txt").write_text("alpha\n", encoding="utf-8")
    (rel / "sub=1" / "b.txt").write_text("beta\n", encoding="utf-8")
    return rel


def test_sha256sums_format_sorted_and_excludes_itself(tmp_path: Path) -> None:
    rel = _tiny_release(tmp_path)
    (rel / "SHA256SUMS").write_text("stale\n", encoding="utf-8")
    text = render_sha256sums(rel)
    lines = text.splitlines()
    assert [ln.split("  ", 1)[1] for ln in lines] == ["a.txt", "sub=1/b.txt"]
    assert all(len(ln.split("  ", 1)[0]) == 64 for ln in lines)
    assert parse_sha256sums(text)["a.txt"] == lines[0].split("  ")[0]


@pytest.mark.parametrize(
    "bad",
    ["abc  file\n", "z" * 64 + "  f\n", "0" * 64 + " f\n"],
)
def test_parse_rejects_malformed_lines(bad: str) -> None:
    with pytest.raises(ValueError):
        parse_sha256sums(bad)


def test_signature_unsigned_by_default() -> None:
    block = signature_block("1.0.0", repo=Path("."), env={})
    assert block == {"status": "unsigned", "note": UNSIGNED_NOTE}


def test_signature_env_without_verifiable_tag_stays_unsigned() -> None:
    def git(_args: list[str], _cwd: Path) -> tuple[int, str]:
        return 1, ""

    block = signature_block(
        "1.0.0",
        repo=Path("."),
        env={"ATLAS_RELEASE_SIGNED": "1"},
        git=git,
    )
    assert block["status"] == "unsigned"
    assert "v1.0.0" in block["note"]


def test_signature_signed_only_when_verify_tag_succeeds() -> None:
    calls: list[list[str]] = []

    def git(args: list[str], _cwd: Path) -> tuple[int, str]:
        calls.append(args)
        return 0, "abc123" if args[0] == "rev-parse" else ""

    block = signature_block(
        "1.0.0",
        repo=Path("."),
        env={"ATLAS_RELEASE_SIGNED": "1"},
        git=git,
    )
    assert block == {
        "status": "signed",
        "tag": "v1.0.0",
        "method": "git tag -s",
        "tag_object": "abc123",
    }
    assert calls[0] == ["verify-tag", "v1.0.0"]


def test_signature_ignores_other_env_values() -> None:
    def git(_args: list[str], _cwd: Path) -> tuple[int, str]:
        raise AssertionError("git must not run")

    block = signature_block(
        "1.0.0",
        repo=Path("."),
        env={"ATLAS_RELEASE_SIGNED": "yes"},
        git=git,
    )
    assert block["status"] == "unsigned"


def test_release_writes_sums_manifest_signature_and_verifies(
    world_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ATLAS_RELEASE_SIGNED", raising=False)
    result = run_release("0.1.0", root=world_root, staging=True, force=True)
    rel = Path(result["path"])
    sums = parse_sha256sums((rel / "SHA256SUMS").read_text(encoding="utf-8"))
    assert "SHA256SUMS" not in sums
    assert "manifest.json" in sums and "README.md" in sums
    assert any(p.startswith("provenance/") for p in sums)
    manifest = json.loads((rel / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["signature"] == {"status": "unsigned", "note": UNSIGNED_NOTE}
    assert verify_release(rel)["ok"] is True


def test_verify_detects_tamper_missing_and_extra(world_root: Path) -> None:
    rel = Path(run_release("0.1.0", root=world_root, force=True)["path"])
    assert verify_release(rel)["ok"]

    (rel / "README.md").write_text("tampered\n", encoding="utf-8")
    problems = verify_release(rel)["problems"]
    assert "SHA256SUMS: hash mismatch: README.md" in problems

    (rel / "extra.txt").write_text("x", encoding="utf-8")
    assert "SHA256SUMS: file not listed: extra.txt" in verify_release(rel)["problems"]
    (rel / "extra.txt").unlink()

    run_release("0.1.0", root=world_root, force=True)
    parts = list((rel / "provenance").rglob("part.parquet"))
    assert parts
    parts[0].unlink()
    problems = verify_release(rel)["problems"]
    assert any("listed file missing: provenance/" in p for p in problems)


def test_verify_detects_manifest_digest_mismatch(world_root: Path) -> None:
    rel = Path(run_release("0.1.0", root=world_root, force=True)["path"])
    path = rel / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["files"][0]["sha256"] = "0" * 64
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    problems = verify_release(rel)["problems"]
    assert any(p.startswith("manifest: sha256 mismatch") for p in problems)
    assert any("hash mismatch: manifest.json" in p for p in problems)


def test_verify_missing_sums_file(world_root: Path) -> None:
    rel = Path(run_release("0.1.0", root=world_root, force=True)["path"])
    (rel / "SHA256SUMS").unlink()
    assert "SHA256SUMS missing" in verify_release(rel)["problems"]


def test_promoted_release_still_verifies(world_root: Path) -> None:
    run_release("0.1.0", root=world_root, staging=True, force=True)
    promoted = promote_release("0.1.0", by="Tester", root=world_root, force=True)
    assert verify_release(Path(promoted["path"]))["ok"] is True


def test_cli_verify_release_exit_codes(world_root: Path) -> None:
    rel = Path(run_release("0.1.0", root=world_root, force=True)["path"])
    ok = runner.invoke(app, ["verify-release", str(rel)])
    assert ok.exit_code == 0, ok.output
    (rel / "CHANGELOG.md").write_text("changed\n", encoding="utf-8")
    bad = runner.invoke(app, ["verify-release", str(rel)])
    assert bad.exit_code == 1
    missing = runner.invoke(app, ["verify-release", str(rel / "nope")])
    assert missing.exit_code == 1
