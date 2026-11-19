# Phase F blockers (human)

## Footer R&D&I project name/code — BLOCKER

The footer still uses the SPEC placeholder:

- EN: `Developed within the R&D&I project [project name/code] of AISERV SYSTEMS SLU (Madrid, Spain).`
- ES: `Desarrollado en el marco del proyecto de I+D+i [nombre/código del proyecto] de AISERV SYSTEMS SLU (Madrid, España).`

UI marker: `data-testid="footer-rd-blocker"` on the footer credit paragraph.

**Do not invent** the project name or code. Replace only when César supplies the exact AISERV wording.

## Tag v1.1.0

Software is already versioned `1.1.0` in package metadata. **Do not** create/push a Git tag `v1.1.0` until César confirms. No Zenodo deposit by the agent.

## Rights-verify (carried from Phase R)

Public data release cells stay empty until human `rights-verify` + RIGHTS.md OK.

## World Bank licence page URL

`https://datacatalog.worldbank.org/public-licenses` returned **404** on 2026-11-19.
WDI/WGI/LPI `licence_url` set to `UNKNOWN` until a human supplies the current licence page.
`licence_id: CC-BY-4.0` remains provisional (not human-verified).

## Full L→F map

See `docs/prompts-l-f-status.md`. Code for L→F is in place; remaining blockers above plus
optional Phase H live BACI product tables after rights.
