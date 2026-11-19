# IMS Atlas v1.0.0 — final checklist

Date: 2026-11-19. Commit / tag: see `git describe --tags`.

| Gate | Status | Evidence |
|------|--------|----------|
| `make lint && make test` | pass at release | CI + local |
| Golden core ↔ ims-backtest (1e-9 deterministic) | pass | `core` vitest goldens |
| E2E Playwright | pass | `make e2e` |
| Lighthouse perf / a11y ≥ 90 | 100 / 100 | `docs/phase12_perf.md` |
| Licence table present | yes | `catalog/LICENSES.md` |
| No BYOD / non-redistributable series in `app/public` or public release | yes | empty indicator release; meta fixtures only |
| CNAME | `atlas.aiserv.es` | `app/public/CNAME` |
| HTTPS live | yes | `https://atlas.aiserv.es/` → 200 |
| Version 1.0.0 across packages | yes | root/app/core/etl/`CITATION.cff` |
| CHANGELOG | yes | `CHANGELOG.md` |
| Zenodo software + dataset | **manual** | `docs/ZENODO_RELEASE.md` |
| Footer AISERV exact project line | **manual** | still placeholder in i18n |
| Copyright line in LICENSE | **manual** | confirm with owners |

## Paper figures

```bash
pnpm --filter @ims-atlas/app run figures
```

Writes PNGs under `paper-figures/` (gitignored; do not commit if &gt; 5 MB).
