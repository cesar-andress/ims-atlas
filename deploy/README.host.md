# IMS Atlas — host notes (vpn-aplicaciones)

| Item | Value |
|------|--------|
| Git origin | `https://github.com/cesar-andress/ims-atlas.git` (or SSH as `cesar-andress`) |
| Checkout | `/opt/services/ims-atlas` |
| Domain | `https://atlas.aiserv.es` (+ `www.atlas.aiserv.es` → apex) |
| Bind | `10.204.0.3:8121` → nginx container (never publish `0.0.0.0:8121`) |
| Edge | Caddy on vpn-server (`aiserv-server`) → `10.204.0.3:8121` |
| Auth | none (public) |

## First install

```bash
ssh vpn-aplicaciones
mkdir -p /opt/services
cd /opt/services
git clone https://github.com/cesar-andress/ims-atlas.git ims-atlas
cd ims-atlas
# Node 20+
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
VITE_BASE=/ pnpm --filter @ims-atlas/core build
VITE_BASE=/ pnpm --filter @ims-atlas/app build
docker compose -f deploy/docker-compose.yml up -d
```

Catalogue entry: [aiserv-applications](https://github.com/cesar-andress/aiserv-applications) `sites.yaml` + `apps/ims-atlas/`.

Edge: [aiserv-server](https://github.com/cesar-andress/aiserv-server) `caddy/Caddyfile` → `./scripts/deploy-caddy.sh` on vpn-server.

## Performance notes

Vite emits route/vendor chunks and precompressed `.gz` siblings. nginx uses
`gzip_static` + long-lived `Cache-Control` for `/assets/*` (immutable hashes)
and `/geo/*` (slim Natural Earth). Home first paint is React + app shell only
(no i18next, MapLibre, or ECharts). Choropleth geometry is local
(`/geo/…slim.geojson`, ~50 KiB gzip) and MapLibre mounts when the map enters
the viewport.

## Update (git only)

```bash
ssh vpn-aplicaciones
cd /opt/services/ims-atlas
git pull --ff-only
mkdir -p status data/release
# Host nginx reads gitignored status/ before the Vite dist copy — sync after pull.
./deploy/sync-public-status.sh
# Node build (see below if no host Node)
pnpm install --frozen-lockfile
VITE_BASE=/ pnpm --filter @ims-atlas/core build
VITE_BASE=/ pnpm --filter @ims-atlas/app build
docker compose -f deploy/docker-compose.yml up -d
```

nginx serves `/status/*` (TTL 60s) and `/data/vX.Y.Z/*` (immutable SPEC §3
release under `data/release/public/`) from the host trees `status/` and
`data/release/`. Legacy `/data/release/*` remains available.

Do **not** scp/rsync the app tree. Publish only via git push → git pull.

## Weekly freshness timer

```bash
sudo cp deploy/ims-atlas-check.service deploy/ims-atlas-check.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ims-atlas-check.timer
# Optional GitHub issue on stale (token never in git):
#   sudo mkdir -p /etc/ims-atlas
#   echo 'GH_TOKEN=…' | sudo tee /etc/ims-atlas/check.env
#   echo 'ATLAS_OPEN_GITHUB_ISSUE=1' | sudo tee -a /etc/ims-atlas/check.env
```

Manual check: `deploy/atlas-etl-check.sh`

## Promote a data release

On a machine with the ETL env (after `make pipeline-fixture && make release-staging`):

```bash
atlas-etl promote 0.1.0 --by "Your Name"
```

Then sync `status/` + `data/release/` on the host (git does not track them) or rebuild
them on the server with the same fixture/live pipeline.

## Build without host Node

vpn-aplicaciones has no system Node; build with the official image:

```bash
cd /opt/services/ims-atlas
./deploy/sync-public-status.sh
docker run --rm -v /opt/services/ims-atlas:/w -w /w -e VITE_BASE=/ node:20-alpine \
  sh -c 'corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @ims-atlas/core build && pnpm --filter @ims-atlas/app build'
docker compose -f deploy/docker-compose.yml up -d
```

## DNS (required for TLS)

Public A/AAAA for `atlas.aiserv.es` and `www.atlas.aiserv.es` must resolve to
`51.83.77.173` at the OVH zone (`dns200.anycast.me` / `ns200.anycast.me`).
Until then Caddy cannot obtain a Let's Encrypt certificate (TLS handshake fails).
Backend health does not depend on DNS: `curl -H 'Host: atlas.aiserv.es' http://10.204.0.3:8121/`.
