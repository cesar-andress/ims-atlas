# Phase 12 — Lighthouse and bundle sizes

Measured locally against `vite preview` on `http://127.0.0.1:4173/` (home route)
after skip-link, mobile read-only, touch-target, and theme-label fixes.

## Lighthouse

| Category | Score |
|----------|------:|
| Performance | **99** (re-measured 2026-11-19 Phase F follow-up) |
| Accessibility | **100** |

SPEC §7 target: both ≥ 90. Prior Phase 12 run was 100/100.

Re-run:

```bash
pnpm --filter @ims-atlas/app build
pnpm --filter @ims-atlas/app exec vite preview --host 127.0.0.1 --port 4173
node scripts/lighthouse-report.mjs http://127.0.0.1:4173/
```

## Bundle sizes (`app/dist/assets`)

| Asset | Bytes |
|-------|------:|
| maplibre-*.js | 802 165 |
| echarts-*.js | 525 149 |
| react-vendor-*.js | 179 874 |
| maplibre-*.css | 65 461 |
| index-*.js (app shell) | ≈27 158 |
| core-*.js | 18 019 |
| index-*.css | ≈12 051 |
| layoutWorker-*.js | 11 362 |

MapLibre and ECharts remain code-split (loaded with map / chart views only).
