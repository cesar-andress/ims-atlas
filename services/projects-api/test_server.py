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


def _req(
    method: str, url: str, body: dict | None = None, user: str = "cesar"
) -> tuple[int, dict | list]:
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


def test_team_crud_share_acl_and_unique_names(tmp_path: Path | None = None) -> None:
    root = Path(tempfile.mkdtemp()) if tmp_path is None else tmp_path
    db = root / "projects.sqlite3"
    os.environ["ATLAS_PROJECTS_DB"] = str(db)
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
            "config": {
                "v": 1,
                "view": "analisis",
                "origin": "COL",
                "hs": "64",
                "year": 2023,
            },
            "yearFrom": 2023,
            "yearTo": 2023,
        }
        code, created = _req("POST", base, project, user="ana")
        assert code == 201
        assert created["id"] == "p-share-1"
        assert created.get("_meta", {}).get("displayId") == 1

        code, listed = _req("GET", base, user="bob")
        assert code == 200
        assert isinstance(listed, list) and any(x["id"] == "p-share-1" for x in listed)
        row = next(x for x in listed if x["id"] == "p-share-1")
        assert row.get("displayId") == 1
        assert row.get("createdBy") == "ana"

        # Bob can see/use, but cannot edit Ana's project.
        project["name"] = "HS64 COL edited"
        code, denied = _req("PUT", f"{base}/p-share-1", project, user="bob")
        assert code == 403
        assert "owner" in str(denied.get("error", "")).lower()

        # Owner can edit.
        code, _ = _req("PUT", f"{base}/p-share-1", project, user="ana")
        assert code == 200

        code, got = _req("GET", f"{base}/p-share-1", user="bob")
        assert code == 200
        assert got["name"] == "HS64 COL edited"

        # Unique names
        other = {
            **project,
            "id": "p-share-2",
            "name": "HS64 COL edited",
        }
        code, conflict = _req("POST", base, other, user="bob")
        assert code == 409

        other["name"] = "HS64 COL bob"
        code, created2 = _req("POST", base, other, user="bob")
        assert code == 201
        assert created2.get("_meta", {}).get("displayId") == 2

        code, del_denied = _req("DELETE", f"{base}/p-share-1", user="bob")
        assert code == 403

        code, deleted = _req("DELETE", f"{base}/p-share-1", user="ana")
        assert code == 200
        assert deleted.get("ok") is True

        # Client error journal ingest
        code, accepted = _req(
            "POST",
            f"{base}/client-errors",
            {
                "schemaVersion": 1,
                "kind": "ims-atlas-client-errors",
                "events": [{"id": "e1", "message": "boom"}],
            },
            user="ana",
        )
        assert code == 200
        assert accepted.get("accepted") == 1
    finally:
        srv.shutdown()
        srv.server_close()
        srv.conn.close()


if __name__ == "__main__":
    test_team_crud_share_acl_and_unique_names()
    print("ok")
