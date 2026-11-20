#!/usr/bin/env python3
"""Team project library API (PLAN §2ter). Auth via Authelia headers from Caddy."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

DB_PATH = Path(os.environ.get("ATLAS_PROJECTS_DB", "/data/projects.sqlite3"))
HOST = os.environ.get("ATLAS_PROJECTS_HOST", "0.0.0.0")
PORT = int(os.environ.get("ATLAS_PROJECTS_PORT", "8130"))
MAX_BODY = int(os.environ.get("ATLAS_PROJECTS_MAX_BODY", str(2_000_000)))

_lock = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          body_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE TABLE IF NOT EXISTS project_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          version_at TEXT NOT NULL,
          edited_by TEXT NOT NULL,
          body_json TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );
        CREATE INDEX IF NOT EXISTS idx_projects_updated
          ON projects(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_versions_project
          ON project_versions(project_id, version_at DESC);
        """
    )
    conn.commit()


def actor_from_headers(headers: Any) -> tuple[str, str] | None:
    user = (
        headers.get("X-Atlas-Auth-User")
        or headers.get("Remote-User")
        or headers.get("Remote-user")
        or ""
    ).strip()
    if not user:
        return None
    name = (
        headers.get("X-Atlas-Auth-Name")
        or headers.get("Remote-Name")
        or headers.get("Remote-name")
        or user
    ).strip() or user
    return user, name


def parse_project(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("Project must be a JSON object.")
    if raw.get("kind") != "ims-atlas-project":
        raise ValueError('Invalid kind (expected "ims-atlas-project").')
    if raw.get("schemaVersion") != 2:
        raise ValueError("schemaVersion must be 2.")
    pid = str(raw.get("id") or "").strip()
    name = str(raw.get("name") or "").strip()
    if not pid or not name:
        raise ValueError("id and name are required.")
    if "config" not in raw:
        raise ValueError("config is required.")
    created = str(raw.get("createdAt") or utc_now())
    updated = str(raw.get("updatedAt") or utc_now())
    body = dict(raw)
    body["id"] = pid
    body["name"] = name[:160]
    body["createdAt"] = created
    body["updatedAt"] = updated
    return body


def list_item(row: sqlite3.Row) -> dict[str, Any]:
    body = json.loads(row["body_json"])
    cfg = body.get("config") if isinstance(body.get("config"), dict) else {}
    item: dict[str, Any] = {
        "id": row["id"],
        "name": row["name"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "createdBy": row["created_by"],
        "updatedBy": row["updated_by"],
        "source": "team",
    }
    origin = cfg.get("origin")
    hs = cfg.get("hs")
    if isinstance(origin, str) and origin:
        item["origin"] = origin
    if isinstance(hs, str) and hs:
        item["hs"] = hs
    yf = body.get("yearFrom", cfg.get("year"))
    yt = body.get("yearTo", cfg.get("year"))
    if isinstance(yf, (int, float)):
        item["yearFrom"] = int(yf)
    if isinstance(yt, (int, float)):
        item["yearTo"] = int(yt)
    if body.get("isExample") is True:
        item["isExample"] = True
    return item


class ProjectsHandler(BaseHTTPRequestHandler):
    server_version = "ims-atlas-projects/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        sys_stderr = __import__("sys").stderr
        print(f"[projects-api] {self.address_string()} {fmt % args}", file=sys_stderr)

    def _send(self, code: int, payload: Any, *, content_type: str = "application/json") -> None:
        raw = (
            payload
            if isinstance(payload, (bytes, bytearray))
            else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        )
        self.send_response(code)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _error(self, code: int, message: str) -> None:
        self._send(code, {"error": message})

    def _read_json(self) -> Any:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            raise ValueError("Empty body.")
        if length > MAX_BODY:
            raise ValueError("Body too large.")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _require_actor(self) -> tuple[str, str] | None:
        actor = actor_from_headers(self.headers)
        if actor is None:
            self._error(HTTPStatus.UNAUTHORIZED, "Authentication required.")
        return actor

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Atlas-Auth-User, X-Atlas-Auth-Name, Remote-User, Remote-Name",
        )
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/api/projects/health":
            self._send(HTTPStatus.OK, {"ok": True})
            return
        actor = self._require_actor()
        if actor is None:
            return
        with _lock:
            conn = self.server.conn  # type: ignore[attr-defined]
            if path in ("/api/projects", "/api/projects/"):
                rows = conn.execute(
                    """
                    SELECT * FROM projects
                    WHERE deleted_at IS NULL
                    ORDER BY updated_at DESC
                    """
                ).fetchall()
                self._send(HTTPStatus.OK, [list_item(r) for r in rows])
                return
            parts = path.split("/")
            # /api/projects/{id} or /api/projects/{id}/versions
            if len(parts) >= 4 and parts[1] == "api" and parts[2] == "projects":
                pid = unquote(parts[3])
                if len(parts) == 5 and parts[4] == "versions":
                    rows = conn.execute(
                        """
                        SELECT id, version_at, edited_by
                        FROM project_versions
                        WHERE project_id = ?
                        ORDER BY version_at DESC
                        LIMIT 50
                        """,
                        (pid,),
                    ).fetchall()
                    self._send(
                        HTTPStatus.OK,
                        [
                            {
                                "id": r["id"],
                                "versionAt": r["version_at"],
                                "editedBy": r["edited_by"],
                            }
                            for r in rows
                        ],
                    )
                    return
                if len(parts) == 4:
                    row = conn.execute(
                        "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL",
                        (pid,),
                    ).fetchone()
                    if row is None:
                        self._error(HTTPStatus.NOT_FOUND, "Project not found.")
                        return
                    body = json.loads(row["body_json"])
                    body["_meta"] = {
                        "createdBy": row["created_by"],
                        "updatedBy": row["updated_by"],
                        "source": "team",
                    }
                    self._send(HTTPStatus.OK, body)
                    return
        self._error(HTTPStatus.NOT_FOUND, "Not found.")

    def do_PUT(self) -> None:  # noqa: N802
        actor = self._require_actor()
        if actor is None:
            return
        user, _name = actor
        path = urlparse(self.path).path.rstrip("/")
        parts = path.split("/")
        if len(parts) != 4 or parts[1] != "api" or parts[2] != "projects":
            self._error(HTTPStatus.NOT_FOUND, "Not found.")
            return
        pid = unquote(parts[3])
        try:
            raw = self._read_json()
            body = parse_project(raw)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            self._error(HTTPStatus.BAD_REQUEST, str(exc))
            return
        if body["id"] != pid:
            self._error(HTTPStatus.BAD_REQUEST, "URL id must match body id.")
            return
        now = utc_now()
        body["updatedAt"] = now
        with _lock:
            conn = self.server.conn  # type: ignore[attr-defined]
            existing = conn.execute(
                "SELECT * FROM projects WHERE id = ?", (pid,)
            ).fetchone()
            if existing is None:
                body.setdefault("createdAt", now)
                conn.execute(
                    """
                    INSERT INTO projects
                    (id, name, body_json, created_at, updated_at, created_by, updated_by, deleted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
                    """,
                    (
                        pid,
                        body["name"],
                        json.dumps(body, ensure_ascii=False),
                        body["createdAt"],
                        now,
                        user,
                        user,
                    ),
                )
            else:
                # Conflict: keep the write as a new version; never drop prior body.
                conn.execute(
                    """
                    UPDATE projects
                    SET name = ?, body_json = ?, updated_at = ?, updated_by = ?, deleted_at = NULL
                    WHERE id = ?
                    """,
                    (
                        body["name"],
                        json.dumps(body, ensure_ascii=False),
                        now,
                        user,
                        pid,
                    ),
                )
            conn.execute(
                """
                INSERT INTO project_versions (project_id, version_at, edited_by, body_json)
                VALUES (?, ?, ?, ?)
                """,
                (pid, now, user, json.dumps(body, ensure_ascii=False)),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM projects WHERE id = ?", (pid,)
            ).fetchone()
        self._send(HTTPStatus.OK, json.loads(row["body_json"]))

    def do_POST(self) -> None:  # noqa: N802
        actor = self._require_actor()
        if actor is None:
            return
        user, _name = actor
        path = urlparse(self.path).path.rstrip("/")
        if path == "/api/projects/migrate-local":
            try:
                raw = self._read_json()
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
                self._error(HTTPStatus.BAD_REQUEST, str(exc))
                return
            if not isinstance(raw, dict) or not isinstance(raw.get("projects"), list):
                self._error(HTTPStatus.BAD_REQUEST, 'Expected {"projects": [...]}')
                return
            saved: list[dict[str, Any]] = []
            with _lock:
                conn = self.server.conn  # type: ignore[attr-defined]
                for item in raw["projects"][:200]:
                    try:
                        body = parse_project(item)
                    except ValueError:
                        continue
                    now = utc_now()
                    body["updatedAt"] = now
                    pid = body["id"]
                    existing = conn.execute(
                        "SELECT id FROM projects WHERE id = ?", (pid,)
                    ).fetchone()
                    if existing is None:
                        body.setdefault("createdAt", now)
                        conn.execute(
                            """
                            INSERT INTO projects
                            (id, name, body_json, created_at, updated_at, created_by, updated_by, deleted_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
                            """,
                            (
                                pid,
                                body["name"],
                                json.dumps(body, ensure_ascii=False),
                                body["createdAt"],
                                now,
                                user,
                                user,
                            ),
                        )
                    else:
                        conn.execute(
                            """
                            UPDATE projects
                            SET name = ?, body_json = ?, updated_at = ?, updated_by = ?, deleted_at = NULL
                            WHERE id = ?
                            """,
                            (
                                body["name"],
                                json.dumps(body, ensure_ascii=False),
                                now,
                                user,
                                pid,
                            ),
                        )
                    conn.execute(
                        """
                        INSERT INTO project_versions (project_id, version_at, edited_by, body_json)
                        VALUES (?, ?, ?, ?)
                        """,
                        (pid, now, user, json.dumps(body, ensure_ascii=False)),
                    )
                    saved.append(list_item(
                        conn.execute(
                            "SELECT * FROM projects WHERE id = ?", (pid,)
                        ).fetchone()
                    ))
                conn.commit()
            self._send(HTTPStatus.OK, {"uploaded": len(saved), "projects": saved})
            return

        if path not in ("/api/projects", "/api/projects/"):
            self._error(HTTPStatus.NOT_FOUND, "Not found.")
            return
        try:
            raw = self._read_json()
            body = parse_project(raw) if isinstance(raw, dict) and raw.get("id") else None
            if body is None:
                # Create empty-ish from partial
                if not isinstance(raw, dict):
                    raise ValueError("Project must be a JSON object.")
                now = utc_now()
                pid = str(raw.get("id") or uuid.uuid4())
                name = str(raw.get("name") or "Untitled project").strip()[:160]
                config = raw.get("config") or {"v": 1, "view": "datos"}
                body = parse_project(
                    {
                        "schemaVersion": 2,
                        "kind": "ims-atlas-project",
                        "id": pid,
                        "name": name,
                        "createdAt": now,
                        "updatedAt": now,
                        "config": config,
                        **{
                            k: raw[k]
                            for k in (
                                "description",
                                "yearFrom",
                                "yearTo",
                                "candidateIsos",
                                "notes",
                                "dataReleaseId",
                                "byodDefinitions",
                                "includeByodValues",
                                "missingPolicyByVar",
                                "isExample",
                            )
                            if k in raw
                        },
                    }
                )
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            self._error(HTTPStatus.BAD_REQUEST, str(exc))
            return
        now = utc_now()
        body["updatedAt"] = now
        body.setdefault("createdAt", now)
        pid = body["id"]
        with _lock:
            conn = self.server.conn  # type: ignore[attr-defined]
            existing = conn.execute(
                "SELECT id FROM projects WHERE id = ?", (pid,)
            ).fetchone()
            if existing is not None:
                self._error(HTTPStatus.CONFLICT, "Project id already exists; use PUT.")
                return
            conn.execute(
                """
                INSERT INTO projects
                (id, name, body_json, created_at, updated_at, created_by, updated_by, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (
                    pid,
                    body["name"],
                    json.dumps(body, ensure_ascii=False),
                    body["createdAt"],
                    now,
                    user,
                    user,
                ),
            )
            conn.execute(
                """
                INSERT INTO project_versions (project_id, version_at, edited_by, body_json)
                VALUES (?, ?, ?, ?)
                """,
                (pid, now, user, json.dumps(body, ensure_ascii=False)),
            )
            conn.commit()
        self._send(HTTPStatus.CREATED, body)

    def do_DELETE(self) -> None:  # noqa: N802
        actor = self._require_actor()
        if actor is None:
            return
        user, _name = actor
        path = urlparse(self.path).path.rstrip("/")
        parts = path.split("/")
        if len(parts) != 4 or parts[1] != "api" or parts[2] != "projects":
            self._error(HTTPStatus.NOT_FOUND, "Not found.")
            return
        pid = unquote(parts[3])
        now = utc_now()
        with _lock:
            conn = self.server.conn  # type: ignore[attr-defined]
            row = conn.execute(
                "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL", (pid,)
            ).fetchone()
            if row is None:
                self._error(HTTPStatus.NOT_FOUND, "Project not found.")
                return
            conn.execute(
                """
                UPDATE projects
                SET deleted_at = ?, updated_at = ?, updated_by = ?
                WHERE id = ?
                """,
                (now, now, user, pid),
            )
            conn.commit()
        self._send(HTTPStatus.OK, {"ok": True, "id": pid, "deletedAt": now})


class ProjectsServer(ThreadingHTTPServer):
    def __init__(self, addr: tuple[str, int], db_path: Path | None = None) -> None:
        super().__init__(addr, ProjectsHandler)
        if db_path is not None:
            global DB_PATH
            DB_PATH = db_path
        self.conn = connect()
        init_db(self.conn)


def main() -> None:
    server = ProjectsServer((HOST, PORT), DB_PATH)
    print(f"[projects-api] listening on {HOST}:{PORT} db={DB_PATH}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        server.conn.close()


if __name__ == "__main__":
    main()
