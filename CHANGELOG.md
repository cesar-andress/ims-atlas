# Changelog

All notable changes to IMS Atlas are documented in this file.

## [1.0.0] — 2026-11-19

### Added

- Browser app: builder, ranking, choropleth, strategic matrix, market map (SMACOF),
  SMAA uncertainty, backtest (T4/T6 fixtures), time bump chart, cite/export, BYOD,
  and in-app docs (methods, glossary, tutorials, FAQ).
- TypeScript `core` engine with golden agreement vs ims-backtest (1e-9 where
  deterministic).
- ETL package `imsatlas_etl` with catalogue validation, licence gate, staging/promote
  release path.
- Demo meta fixtures (COL HS64 ranking, T4/T6, multi-year ranks) under `app/public/meta/`.
- Playwright e2e coverage and paper-figure capture script (`pnpm figures`).
- Accessibility pass (skip link, focus, mobile read-only); Lighthouse home ≥ 90.

### Data

- Software release **v1.0.0**. Public data release **v1.0.0** ships only
  redistributable+verified series (currently an empty shell until licences are
  verified for redistribution). BYOD and non-redistributable series are never
  published in `data/release` or `app/public`.

### Notes

- Software and data DOIs remain pending until Zenodo deposits are created
  (see `docs/ZENODO_RELEASE.md`).
- Custom domain: `https://atlas.aiserv.es` (CNAME / HTTPS via aiserv edge).

## [0.1.0] — 2026-11-19

- Initial scaffold through Phase 12 development on `main`.
