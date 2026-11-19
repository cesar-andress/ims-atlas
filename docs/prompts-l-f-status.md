# PROMPTS.md L→F status (2026-11-19 audit)

Agent audit against the pasted PROMPTS order. **Do not invent** rights, R&D text, or tag.

| Phase | Status | Notes |
|-------|--------|-------|
| L | Done (code) + ops partial | Live connectors, changes/history, updates UI, ef_epi, version banner. Live ETL ran locally; **no public release publish** until rights-verify. |
| I | Done (code + edge) | ABIERTO/CERRADO stores, Entrar, privacy, Authelia live (`/datos-cerrados` → 302 auth). Users/emails still César-only. |
| D | Done (code) | Provenance, Verificar, verify-release, reproduce, spot-check UI. Spot-check network run is hand ops. |
| H | Partial | Product banners + HS paths exist; full BACI HS4/6 product features need live BACI + rights before ship. |
| R | Blocked human | Rights still `unknown` / `checked_by: null`. Dual staging scaffolding exists; public cells empty by gate. |
| J | Done (code) | IMSFE preset, EOC, AHP, export book. Workbook golden optional (env path); ask before commit of authors' table. |
| Z | Done | NormLab + docs + TS/Py goldens. |
| G | Done | Projects IDB, coverage, variables, dashboard, e2e. |
| E | Done | Search, explore, country, analysis, SQL. |
| X | Done + follow-up | Shared ExportMenu; remaining tables/charts wired in gap pass. PDF companion text (not embedded bitmap). |
| N | Done | Docs, help drawer, paper, changelog. |
| F | Done except blockers | Footer placeholder, link-check, budgets, Lighthouse. **No v1.1.0 tag** until César confirms. |

## Still need from César

1. Exact AISERV R&D&I footer wording.
2. Confirm git tag `v1.1.0` (no Zenodo by agent).
3. `rights-verify` + RIGHTS.md OK for redistribute sources.
4. Current World Bank licence page URL (datacatalog public-licenses 404).
5. Optional: workbook path for J golden commit; Authelia user emails; live ETL promote.

## Out of this file

`PROMPTS_ADVANCE.md` (A0…) and `PROMPTS_GUI.md` (W/U/M) are separate tracks.
