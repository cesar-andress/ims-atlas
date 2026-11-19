# IMS Atlas — team access (Authelia + `/datos-cerrados`)

Phase I scaffolding only: no secrets or real credentials belong in this Git tree.
Production state lives on the host under `/opt/services/authelia/` (outside the
ims-atlas checkout).

## Topology

| Piece | Role |
|-------|------|
| **Edge** | Caddy on vpn-server (`aiserv-server`) — TLS, `forward_auth`, headers |
| **Portal** | `https://auth.aiserv.es` — already proxies to Authelia on vpn-aplicaciones **`10.204.0.3:9091`** (do not republish Authelia on `0.0.0.0`) |
| **App origin** | nginx on vpn-aplicaciones `10.204.0.3:8121` — public SPA + static cerrada tree at `/datos-cerrados/` |
| **Policy** | Authelia `access_control`: default **deny**; rule for `atlas.aiserv.es` + `resources: ['^/datos-cerrados/.*$']` + `subject: ['group:equipo']` → **two_factor** |

nginx serves files only; it does **not** authenticate. Caddy enforces Authelia on
the edge. Local Playwright coverage uses `deploy/docker-compose.access-e2e.yml`
(Caddy + Authelia + nginx).

Apply the Caddy snippet from `deploy/caddy/atlas-datos-cerrados.snippet` on
aiserv-server (patch file in the same directory). Do **not** commit aiserv-server
changes from this repo.

## Secrets (`*_FILE`)

Authelia recommends file-based secrets instead of inline values or plain env vars.
See [Secrets](https://www.authelia.com/configuration/methods/secrets/).

Typical files on the host (mode `0600`, root-owned):

| File | Env var consumed by container |
|------|--------------------------------|
| `session.secret` | `AUTHELIA_SESSION_SECRET_FILE` |
| `storage.encryption_key` | `AUTHELIA_STORAGE_ENCRYPTION_KEY_FILE` |
| `notifier.smtp.password` (if SMTP) | `AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE` |

Template env placeholders: `deploy/access/authelia.env.example`. Copy to
`/opt/services/authelia/authelia.env` and point each `*_FILE` variable at the
matching path.

Never commit generated secrets, SMTP passwords, or production `users_database.yml`.

## Notifier: SMTP vs filesystem

| Notifier | When to use |
|----------|-------------|
| **SMTP** | Production — password reset, identity verification, device registration |
| **Filesystem** (`notifier: filesystem`) | Labs and `docker-compose.access-e2e.yml` — emails written as files under a directory |

Production: configure real SMTP (host, port, username) and load the password via
`AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE`. Filesystem notifier must not be used when
users need self-service email flows in production.

Reference: [Notifier SMTP](https://www.authelia.com/configuration/notifier/smtp/) and
[Notifier File System](https://www.authelia.com/configuration/notifier/file-system/).

## User administration (César)

Use `deploy/access/atlas-user` on a machine with Docker and access to
`/opt/services/authelia/users_database.yml`.

```bash
export AUTHELIA_DATA_DIR=/opt/services/authelia
export AUTHELIA_CONTAINER=authelia   # running Authelia container name

# Add team member (prompts for password on tty; or pass as second arg — avoid shell history)
./deploy/access/atlas-user add jdoe "Display Name" jdoe@example.com

./deploy/access/atlas-user disable jdoe
./deploy/access/atlas-user enable jdoe
./deploy/access/atlas-user reset jdoe
./deploy/access/atlas-user remove jdoe
```

Password hashing:

1. Prefer `docker exec` into the running Authelia container:
   `authelia crypto hash generate argon2 --password '…'`
2. Fallback: `docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 …`

After any change, restart Authelia (or rely on file watcher if enabled) and verify
login at `https://auth.aiserv.es` before announcing access.

Example file layout on disk:

```
/opt/services/authelia/
  configuration.yml          # from configuration.yml.example + secrets via env
  users_database.yml         # live users (NOT in git)
  db.sqlite3                 # Authelia storage
  secrets/                   # *_FILE targets
  authelia.env               # AUTHELIA_*_FILE paths only
```

## SQLite backup (Authelia storage)

Authelia stores sessions, TOTP secrets, and regulation state in SQLite when using
`storage.local`. Path example: `/opt/services/authelia/db.sqlite3`.

Backup procedure:

1. Stop Authelia or use an online copy while Authelia is idle (simplest: brief stop).
2. Copy the database file and the encryption key material (via `AUTHELIA_STORAGE_ENCRYPTION_KEY_FILE`).
3. Store offline; test restore on a staging container before relying on a backup.

```bash
sudo systemctl stop authelia   # or docker stop authelia
sudo cp -a /opt/services/authelia/db.sqlite3 "/var/backups/authelia/db-$(date -u +%Y%m%dT%H%MZ).sqlite3"
sudo systemctl start authelia
```

Without the **same** `encryption_key`, the SQLite file is unusable. Back up both
together.

Reference: [SQLite storage](https://www.authelia.com/configuration/storage/sqlite/).

## `whoami.json`

The app may call `/datos-cerrados/whoami.json` to show the signed-in team identity.
Caddy should authenticate the request, then either:

- **Synthesize JSON** from `Remote-*` headers copied by `forward_auth` (see snippet), or
- **Proxy** to nginx if a static stub is enough for a given environment.

E2E compose uses a Caddy `respond` template; production snippet documents header-based JSON.

## Official Authelia documentation (verified 2026-11-19)

| Topic | URL |
|-------|-----|
| Configuration prologue | https://www.authelia.com/configuration/prologue/introduction/ |
| Secrets / `*_FILE` | https://www.authelia.com/configuration/methods/secrets/ |
| User database / password hashes | https://www.authelia.com/reference/guides/passwords/ |
| Access control | https://www.authelia.com/configuration/security/access-control/ |
| Regulation (brute force) | https://www.authelia.com/configuration/security/regulation/ |
| Session cookies | https://www.authelia.com/configuration/session/introduction/ |
| Caddy integration | https://www.authelia.com/integration/proxies/caddy/ |
| Forward Auth authz endpoint | https://www.authelia.com/reference/guides/proxy-authorization/ |

## Local E2E stack

```bash
# /etc/hosts on the test machine:
#   127.0.0.1 atlas.e2e.local auth.atlas.e2e.local

cd /path/to/ims-atlas
docker compose -f deploy/docker-compose.access-e2e.yml up -d
# Portal: https://auth.atlas.e2e.local:18443  App: https://atlas.e2e.local:18443/datos-cerrados/
# Credentials: deploy/access/e2e-test-credentials.env.example (TEST ONLY)
```

Copy `deploy/access/e2e-test-credentials.env.example` to `deploy/access/e2e-test-credentials.env`
before first run (example is safe to commit; `.env` is local only).

## Related repo docs

- ETL access modes: `docs/run-etl.md`
- Host deploy (public site): `deploy/README.host.md`
- Example Authelia config: `deploy/access/configuration.yml.example`