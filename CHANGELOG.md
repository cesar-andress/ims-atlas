# Changelog

All notable changes to IMS Atlas are documented in this file.

## [Unreleased]

### Added

- Phase F polish: footer Atlas credit + R&D placeholder blocker marker, Matrix/Factors
  ExportMenu, `make link-check` / `make bundle-budgets` / `make phase-f`, and
  `docs/phase-f-blockers.md` + review notes. **No v1.1.0 git tag** until human confirm.
- Phase F follow-up: ExportMenu on Backtest, Uncertainty, NormLab, Explore, country
  profile, explore correlation, and Sources tables.
- L→F gap pass: ExportMenu on remaining tables (SQL, paper T4, coverage, status,
  releases, pipeline, variable coverage) and chart export for SMAA/tornado/matrix
  scatter; Compare chart surfaces marked; `docs/prompts-l-f-status.md`.
- GUI-0: results dashboard (KPI cards, LineUp-style ranking, why panel, IMSFE×EOC
  matrix, next steps), design tokens, Okabe–Ito criterion colours, Jose quadrant
  copy from workbook; ranking is read-only (0 editable inputs); config panel only
  on builder / norm lab / project variables.
- Phase N content: expanded Docs (getting started, non-experts, researchers, IMSFE
  workflow, projects, sources, cite), contextual `?` help drawer, `/paper` T4 tables
  with permalinks, and `/changelog` generated from `CHANGELOG.md`.
- Phase X exports: shared `ExportMenu` (PNG 1×/2×/4×, SVG, PDF, CSV, XLSX with LEEME
  sheet), Atlas credit in image metadata/SVG, licence gate helpers, full-analysis
  XLSX/ZIP, PDF report, and IMSFE workbook export from Cite & export.
- Phase E data explorer: global search (`/` in header), `/explore` table with filters
  and URL state, “My variables” basket, country profile, correlation/scatter analysis,
  and expert read-only SQL console (DuckDB-WASM).
- Phase G projects: versioned `.atlas.json` model, IndexedDB library (localStorage /
  memory fallback), `/projects` list (create/rename/duplicate/delete/open), save toast +
  unsaved dot + Ctrl/Cmd+S + draft autosave, project variables + coverage check +
  dashboard, tables ZIP export; PDF deferred to Phase X.
- Phase Z normalisation lab: per-variable pipeline (skew → winsor → scale →
  direction-after), robust z, correlation warnings (|ρ|≥0.8), optional whitening
  (off by default), Norm lab UI (`/norm_lab`), docs “Why normalise?”, and
  TS↔Python goldens @ 1e-9 for transforms.
- Phase J IMSFE faithful mode: pre-selection funnel, DMP/IMP aliases, AHP,
  expert-survey aggregation (Expert 1..n), cultural distance, IMSFE×EOC
  quadrants (Baena & Cano wording), one-at-a-time winner sensitivity, method
  family presets (IMSFE 2025 / SMI 2018 / SMI 2020+), Jose-code catalog drafts,
  workbook weight extractor (`IMSFE_WORKBOOK_PATH`), and Tablas/Standardization
  discrepancy note (`docs/imsfe-tablas-discrepancy.md`).
- Phase R dual release audiences: `atlas-etl release --audience public|internal`,
  staging under `data/release/staging[/internal]/vX.Y.Z`, promote with
  `--audience`, and `status/release_report_vX.Y.Z.md`. Public stays empty until
  human `rights-verify` + RIGHTS.md OK (SPEC §13).
- Phase H all HS products: BACI country×product metrics (IMPV/GRW/HHI/ASIASH/
  REEXP/IMPC) at HS2/4/6, `country_product/hs2=*/` partitions, DuckDB chapter
  loaders, product context banner, olive-oil/vehicles home examples, COL·HS64
  paper fixtures gated to that preset, grep guard against silent `?? \"64\"`.
- Phase I ABIERTO/CERRADO: `access_mode` in `config/deployment.yaml`, dual
  stores under `data/store/{abierta,cerrada}`, taint rule, Entrar/Acceso equipo
  header, `/privacidad`, deploy/access Authelia scaffolding, `/datos-cerrados/`
  nginx path (auth at Caddy edge).
- Phase D verifiable data: cell provenance (`provenance.parquet` /
  `provenance.jsonl`), `SHA256SUMS` + `atlas-etl verify-release`,
  `make reproduce-release` / `docs/reproduce.md`, seeded
  `atlas-etl spot-check`, terms-page drift flag, and UI “Verificar este dato”
  (World Bank live re-check) on Factors, Ranking, and variable coverage.
- Phase 7b transparency views: `/status`, `/data/sources`, `/data/variables/:id`,
  `/data/pipeline`, `/data/releases` (values from `status/*.json` + release
  manifest via `atlas-etl export-transparency`).

### Fixed

- Public demo panel no longer ships BYOD raw values for TARIF/CULT; full panel
  lives under `app/e2e/fixtures/` only. ETL `test_public_licence_guard` blocks
  redistributable:false / byod_only value keys in `app/public` and `app/dist`.
- Permalink `lang=es` applies on first paint; P(top-k) table sorts by P(top-10);
  Spanish footer credit string.
- nginx serves versioned release files under `/data/v…` so SPA `/data/*` routes work.

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
