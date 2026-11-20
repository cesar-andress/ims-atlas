# Phase F blockers (human)

## Footer R&D&I credit — resolved without inventing a code

The bracketed placeholder was shown on the live site. It is replaced by a neutral sentence
that names no project:

- ES: `Desarrollado por AISERV SYSTEMS SLU (Madrid, España) en el marco de un proyecto de I+D+i.`
- EN: `Developed by AISERV SYSTEMS SLU (Madrid, Spain) as part of an R&D&I project.`

If César later supplies the exact project name/code, add it to `footerCredit` in both
locales. `AppFooter` still flags any `[project name/code]` marker as `footer-rd-blocker`.

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
