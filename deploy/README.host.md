# IMS Atlas — host notes (vpn-aplicaciones)

| Item | Value |
|------|--------|
| Git origin | `https://github.com/cesar-andress/ims-atlas.git` (or SSH as `cesar-andress`) |
| Checkout | `/opt/services/ims-atlas` |
| Bulk data | `/data/ims-atlas` (raw, curated, release, store, …); `/opt/services/ims-atlas/data` → symlink |
| Domain | `https://atlas.aiserv.es` (+ `www.atlas.aiserv.es` → apex) |
| Bind | `10.204.0.3:8121` → nginx container (never publish `0.0.0.0:8121`) |
| Edge | Caddy on vpn-server (`aiserv-server`) → `10.204.0.3:8121` |
| Auth | Authelia via Caddy (public: `/`, `/metodologia`, `/privacidad`, `/aviso-legal`, `/landing/*`, assets) |

## Data volume (`/data`)

On vpn-aplicaciones the git checkout stays on the root LV under `/opt/services/ims-atlas`.
Bulky trees live on the large `/data` volume:

- Canonical store: `/data/ims-atlas/{raw,curated,manual,release,store,static,local}`
- Repo path: `/opt/services/ims-atlas/data` → `/data/ims-atlas` (symlink)

Compose still mounts `../data/release` and `../data/store/cerrada` relative to the
checkout. Docker ETL jobs keep `-v /opt/services/ims-atlas:/w` and `ATLAS_ROOT=/w`;
writes go through the symlink onto `/data`. Do not put large releases back on `/opt`.

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

## Data root on the host

Production checkout keeps `ATLAS_ROOT=/opt/services/ims-atlas`. Large trees live
on the data volume via symlink:

```text
/opt/services/ims-atlas/data → /data/ims-atlas
```

ETL helpers bind-mount the resolved path over `/w/data` inside Docker so the
symlink does not break container access. Compose mounts
`../data/release` and `../data/store/cerrada` the same way (host resolves the
symlink).

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

## Hourly incremental timer

`ims-atlas-pipeline.timer` runs every hour (`Timezone=Europe/Madrid`). It only
runs `atlas-etl hourly` (per-source check/extract), then
`sync-public-status.sh`, `check-current`, and compose reload. Shared flock:
`/var/lock/ims-atlas-pipeline.lock`. If the daily job holds the lock, hourly
exits 0 with `skip: previous pipeline still running`.

```bash
sudo cp deploy/ims-atlas-pipeline.service deploy/ims-atlas-pipeline.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ims-atlas-pipeline.timer
```

## Daily full pipeline timer

`ims-atlas-daily.timer` at **03:30 Europe/Madrid** (`RandomizedDelaySec=3m`).
Host `timedatectl` is often `Etc/UTC`; the unit sets `Timezone=Europe/Madrid`
explicitly (winter ≈ 02:30 UTC, summer ≈ 01:30 UTC).

Sets `ATLAS_FULL_RELEASE=1` and runs, in order:

1. wait if `/data` migration or `atlas-release-dual` is still moving data
2. blocking flock (hourly skips while this runs)
3. `atlas-etl hourly` (stale check/extract)
4. `atlas-etl run --live --force` (validate/transform/QA)
5. `release-dual --version $V --force` (public + internal staging; writes local
   `.zenodo.dataset.json` only — **no** Zenodo upload, **no** GitHub tag)
6. `promote` public then internal (`--by pipeline` by default)
7. `export-transparency` → `sync-public-status.sh` → `check-current` → compose

Version `$V` = `ATLAS_RELEASE_VERSION` if set in `/etc/ims-atlas/check.env`,
else the value in `data/release/internal/CURRENT` (strip leading `v`). The
script refuses to invent a version. Public promote still applies the usual
verified + redistributable gates (no CULT / closed rights invented).

Logs: `journalctl -u ims-atlas-daily.service` and
`/var/log/ims-atlas/ims-atlas-daily.log` (hourly → `ims-atlas-pipeline.log`).

```bash
sudo cp deploy/ims-atlas-daily.service deploy/ims-atlas-daily.timer \
  deploy/ims-atlas-pipeline.service deploy/ims-atlas-pipeline.timer \
  /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ims-atlas-daily.timer
systemctl list-timers 'ims-atlas-*'
# Manual full run:
#   sudo systemctl start ims-atlas-daily.service
#   journalctl -u ims-atlas-daily.service -n 200 --no-pager
#   tail -f /var/log/ims-atlas/ims-atlas-daily.log
```

Requires host Docker, network access to source APIs, and the manual drops under
`data/manual/` (BACI, Gravity, and any STEP 3 manual sources). Do **not** commit
those drops. Shrink guards and empty-`country_product` refuses stay loud
(non-zero exit → systemd failure / optional alert via check.env).

## Promote a data release

On a machine with the ETL env (after `make pipeline-fixture && make release-staging`):

```bash
# Prefer a non-person promoter label in automation (e.g. pipeline).
atlas-etl promote 0.1.0 --by "pipeline" --audience internal
```

Then sync `status/` + `data/release/` on the host (git does not track them) or rebuild
them on the server with the same fixture/live pipeline.

Release builds **refuse** an empty `country_product` when curated has ≥90 HS2
chapters, and refuse >20 % row shrink vs the previous release of the same
audience. Promote keeps the last **3** version directories. Promote also refuses
to move `CURRENT` onto an empty `country_product` (or demote from a newer full
release to an older one) unless `--allow-pointer-demote` is set. Hourly
pipeline runs `atlas-etl check-current` so a stale/empty pointer fails the tick.

### Repair empty internal `country_product` (ops)

If `data/release/internal/vX.Y.Z/country_product` only has `hs2=_empty` while
`data/curated/country_product_by_hs2` is full, publish a **new** version (do not
overwrite the broken tree) from curated:

```bash
cd /opt/services/ims-atlas
docker run --rm -v "$PWD:/w" -w /w -e ATLAS_ROOT=/w --memory=24g \
  ghcr.io/astral-sh/uv:python3.11-bookworm-slim \
  bash -lc 'apt-get update -qq && apt-get install -y -qq git >/dev/null \
    && cd /w/etl && uv sync --group dev \
    && uv run python ../scripts/repair_internal_release_product.py \
    --root /w --from-version 1.1.0 --to-version 1.2.0'
./deploy/sync-public-status.sh
docker compose -f deploy/docker-compose.yml up -d
```

Writes `status/internal_release_repair.json` with the cause note.

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
