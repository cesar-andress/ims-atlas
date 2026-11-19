# IMS Atlas

Open, browser-based tool to **build, compare, stress-test and backtest** international
market selection (IMS) indices on open data. All computation runs in the browser; there
is no backend and no accounts.

> Developed within the R&D&I project [project name/code] of AISERV SYSTEMS SLU (Madrid, Spain).

## Status

**v1.0.0** — browser app (ranking, matrix, map, SMAA, backtest, time, cite, BYOD, docs),
TypeScript `core` with ims-backtest goldens, ETL + licence gate. Live:
[`https://atlas.aiserv.es`](https://atlas.aiserv.es).

Release notes: [CHANGELOG.md](CHANGELOG.md). Zenodo steps: [docs/ZENODO_RELEASE.md](docs/ZENODO_RELEASE.md).
Checklist: [docs/V1_CHECKLIST.md](docs/V1_CHECKLIST.md).

```bash
make catalog-validate   # variables.yaml + sources.yaml
make rights-report      # writes catalog/RIGHTS.md (gate decisions)
make pipeline-fixture   # offline mini-world DAG -> data/curated + status/
make release-staging    # QA + staging release (set version in Make / CLI)
make promote-release BY="Your Name"   # staging -> public
make figures            # paper screenshots -> paper-figures/ (gitignored)
```

Promote data: `atlas-etl promote 1.0.0 --by "<name>"` after reviewing staging.
Weekly check: install `deploy/ims-atlas-check.{service,timer}` on the host.

Every source currently needs a human `atlas-etl rights-verify <SOURCE> --by "<name>"`
plus yes/no rights flags before any variable can `ship_*` (releases include curated
tables; variable columns stay excluded until the gate allows `ship_*`).

## Repository layout

| Path | Role |
|------|------|
| `app/` | Vite + React static site |
| `core/` | Pure TypeScript MCDM / SMAA / backtest library |
| `etl/` | Python 3.11 (`uv`) data build + `atlas-etl` CLI |
| `catalog/` | Variable catalog (Phase 1+) |
| `docs/` | Methods and tutorials (rendered in the app later) |
| `deploy/` | nginx + Compose for vpn-aplicaciones |
| `config/site.json` | Single config value for the public domain |

## Requirements

- Node.js **20** LTS (see `.nvmrc`) and `pnpm` 9
- Python **3.11** and [`uv`](https://github.com/astral-sh/uv)

```bash
make setup
make lint
make test
make build
make dev
```

## Production (AISERV)

Public hostname: **`https://atlas.aiserv.es`** (DNS A → `51.83.77.173` / vpn-server).

| Layer | Host | Repo / path |
|-------|------|-------------|
| Edge TLS + proxy | vpn-server (`10.204.0.1`) | [aiserv-server](https://github.com/cesar-andress/aiserv-server) Caddy → `10.204.0.3:8121` |
| Static build + nginx | vpn-aplicaciones (`10.204.0.3`) | this repo at `/opt/services/ims-atlas` |
| Catalogue | vpn-aplicaciones | [aiserv-applications](https://github.com/cesar-andress/aiserv-applications) `sites.yaml` |

Deploy is **git-only** (push → `git pull --ff-only` on the hosts). See [`deploy/README.host.md`](deploy/README.host.md).

`config/site.json` sets `domain: aiserv.es` and drives `app/public/CNAME` (`make cname`). Production builds use `VITE_BASE=/`.

## Licence

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 César Andrés-Sanchez and AISERV SYSTEMS SLU.

## Cite

See [CITATION.cff](CITATION.cff). Zenodo deposit metadata: [.zenodo.json](.zenodo.json)
(`upload_type: software`, related identifier `isSupplementTo` → ims-backtest).

## Related software

- [ims-backtest](https://github.com/cesar-andress/ims-backtest) — reference Python engine
  (pin ETL to a **git tag** via `config/ims-backtest.json`; never a branch).
