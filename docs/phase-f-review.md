# Phase F — Wildcard review (agent)

Scope: current `main` after Phases E/X/N, against SPEC.md + PROMPTS standing rules.
Severity: Critical / High fixed in this phase where feasible; Medium/Low logged.

## Critical

| Issue | Status |
|-------|--------|
| Invented R&D&I project name/code in footer | **Not invented.** Placeholder kept; `footer-rd-blocker` + `docs/phase-f-blockers.md`. |
| Synthetic ranking panel in public `app/public` | Guarded by `test_public_synthetic_guard` / pending demo. OK. |
| Verified rights without human check | Rights remain `unknown` / `checked_by: null`. OK. |

## High (fixed or gated)

| Issue | Action |
|-------|--------|
| Matrix / Factors tables without ExportMenu | ExportMenu added (derived scores/ranks). |
| Catalog source URLs unchecked | `make link-check` → `status/source_links.json`; core WB URLs must pass. |
| `datacatalog…/public-licenses` 404 | Set WDI/WGI/LPI `licence_url: UNKNOWN` + evidence note (no invented replacement). |
| Bundle growth unchecked | `make bundle-budgets` after build. |
| Footer missing Atlas credit line | Added `footer-atlas-credit`. |

## Medium (not blocking Phase F)

- Remaining tables (Backtest, Uncertainty, NormLab, Explore, transparency) still lack ExportMenu on every surface — extend in a follow-up.
- Chart PDF export is a text companion PDF, not an embedded bitmap.
- Public `status/*` is fixture-flagged (`is_fixture: true`); live ETL still a human ops step.
- Some third-party landing pages may return 403 to bots; recorded in link report, not treated as core failures.

## Low

- `ChartExportBar` still wraps `ExportMenu` (deprecated alias).
- Lighthouse re-measure: run `scripts/lighthouse-report.mjs` against `vite preview` when convenient; last documented scores were 100/100 (Phase 12).

## Explicitly not done

- Git tag `v1.1.0` / Zenodo deposit — wait for César.
