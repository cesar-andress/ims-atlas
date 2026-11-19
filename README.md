# IMS Atlas

Open, browser-based tool to **build, compare, stress-test and backtest** international
market selection (IMS) indices on open data. All computation runs in the browser; there
is no backend and no accounts.

> Developed within the R&D&I project of AISERV SYSTEMS SLU.
> **[PENDING — paste the exact official wording here.]**

## Status

Phase 0 scaffold (`v0.1.0`). Engine, ETL connectors and data release land in later phases.

## Repository layout

| Path | Role |
|------|------|
| `app/` | Vite + React static site (GitHub Pages) |
| `core/` | Pure TypeScript MCDM / SMAA / backtest library |
| `etl/` | Python 3.11 (`uv`) data build + `atlas-etl` CLI |
| `catalog/` | Variable catalog (Phase 1+) |
| `docs/` | Methods and tutorials (rendered in the app later) |
| `config/site.json` | Single config value for the custom domain |

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

## Custom domain (GitHub Pages)

1. Set `domain` in [`config/site.json`](config/site.json) (e.g. `example.com` → site host
   `atlas.example.com`).
2. Run `make cname` to write `app/public/CNAME`.
3. Create a DNS **CNAME** record:
   - Name: `atlas`
   - Target: `cesar-andress.github.io`
4. In the GitHub repo: **Settings → Pages → Custom domain** = `atlas.<your-domain>`,
   then enable **Enforce HTTPS**.
5. The site must also keep working at
   `https://cesar-andress.github.io/ims-atlas/` (Pages workflow defaults
   `VITE_BASE=/ims-atlas/`). After the custom domain is live, set the repository
   variable `VITE_BASE` to `/` so asset paths match the apex custom host.

## Licence

MIT — see [LICENSE](LICENSE). Copyright line is pending maintainer confirmation.

## Cite

See [CITATION.cff](CITATION.cff). Zenodo deposit metadata: [.zenodo.json](.zenodo.json)
(`upload_type: software`, related identifier `isSupplementTo` → ims-backtest).

## Related software

- [ims-backtest](https://github.com/cesar-andress/ims-backtest) — reference Python engine
  (pin ETL to a **git tag** via `config/ims-backtest.json`; never a branch).
