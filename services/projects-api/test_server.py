"""Smoke tests for the team projects API (stdlib only)."""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import server as api


def _req(method: str, url: str, body: dict | None = None, user: str = "cesar") -> tuple[int, dict | list]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "X-Atlas-Auth-User": user,
            "X-Atlas-Auth-Name": user,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        payload = json.loads(exc.read().decode("utf-8"))
        return exc.code, payload


def test_team_crud_and_share(tmp_path: Path | None = None) -> None:
    root = Path(tempfile.mkdtemp()) if tmp_path is None else tmp_path
    db = root / "projects.sqlite3"
    os.environ["ATLAS_PROJECTS_DB"] = str(db)
    # Re-bind module path used by connect()
    api.DB_PATH = db
    srv = api.ProjectsServer(("127.0.0.1", 0), db)
    port = srv.server_address[1]
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.05)
    base = f"http://127.0.0.1:{port}/api/projects"
    try:
        code, health = _req("GET", f"{base}/health")
        assert code == 200 and health.get("ok") is True

        project = {
            "schemaVersion": 2,
            "kind": "ims-atlas-project",
            "id": "p-share-1",
            "name": "HS64 COL",
            "createdAt": "2026-11-20T10:00:00Z",
            "updatedAt": "2026-11-20T10:00:00Z",
            "config": {"v": 1, "view": "analisis", "origin": "COL", "hs": "64", "year": 2023},
            "yearFrom": 2023,
            "yearTo": 2023,
        }
        code, created = _req("POST", base, project, user="ana")
        assert code == 201
        assert created["id"] == "p-share-1"

        code, listed = _req("GET", base, user="bob")
        assert code == 200
        assert isinstance(listed, list) and any(x["id"] == "p-share-1" for x in listed)

        project["name"] = "HS64 COL edited"
        project["config"] = {
            **project["config"],
            "weights": {"market_size": 0.5},
        }
        code, _ = _req("PUT", f"{base}/p-share-1", project, user="bob")
        assert code == 200

        code, got = _req("GET", f"{base}/p-share-1", user="ana")
        assert code == 200
        assert got["name"] == "HS64 COL edited"
        assert got["config"]["weights"]["market_size"] == 0.5

        code, versions = _req("GET", f"{base}/p-share-1/versions", user="ana")
        assert code == 200
        assert isinstance(versions, list) and len(versions) >= 2
        editors = {v["editedBy"] for v in versions}
        assert "ana" in editors and "bob" in editors
    finally:
        srv.shutdown()
        srv.server_close()
        srv.conn.close()


if __name__ == "__main__":
    test_team_crud_and_share()
    print("ok")
