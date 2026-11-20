# Running the ETL — ABIERTO vs CERRADO

IMS Atlas materialises two on-disk stores under `data/store/`:

| Store | Path | Contents |
|-------|------|----------|
| **abierta** | `data/store/abierta/` | Sources with verified redistribution rights only |
| **cerrada** | `data/store/cerrada/` | Full curated panel for the AISERV team (includes non-redistributable inputs) |

## Access modes

| Mode | Who uses it | ETL behaviour |
|------|-------------|----------------|
| **ABIERTO** | Third parties reproducing the pipeline without team credentials | Runs only sources classified as **abierta** (see `imsatlas_etl.access.source_store`) |
| **CERRADO** | AISERV production (`config/deployment.yaml` on `atlas.aiserv.es`) | Runs **all** configured sources; writes both stores |

Assignment logic lives in `etl/src/imsatlas_etl/access.py`. A source lands in **abierta**
only when rights evidence is complete and `redistribute_raw` or `redistribute_derived`
is `yes`; otherwise it is **cerrada**. Tables inherit the most restrictive input
(`taint`).

## Commands

Default mode follows `config/deployment.yaml` (`access_mode`). Override per run:

```bash
cd etl
uv run atlas-etl run --access-mode ABIERTO --fixture-root tests/fixtures/mini_world
uv run atlas-etl run --access-mode CERRADO --fixture-root tests/fixtures/mini_world
```

Production host (`access_mode: CERRADO` in `config/deployment.yaml`):

```bash
uv run atlas-etl run --live
```

After a CERRADO run, sync or publish `data/store/cerrada/` to the server path served
at `https://atlas.aiserv.es/datos-cerrados/` (see `deploy/nginx.conf`). That URL is
**not** public: edge auth is Authelia via Caddy (`deploy/README-access.md`).

Third-party reproducers must use **ABIERTO** only; they receive **abierta** artifacts
via Zenodo/public release paths, not `/datos-cerrados/`.

## Web exposure

| Surface | ABIERTO reproducer | AISERV CERRADO |
|---------|-------------------|----------------|
| Public SPA + `/data/v*` release | yes | yes (public slice) |
| `data/store/abierta` | yes (local or published subset) | yes |
| `data/store/cerrada` / `/datos-cerrados/*` | no | yes (team, 2FA) |

Run log field `access_mode` in ETL output records which mode executed.
## Step 3 file-download sources

`inform_risk`, `transparency_cpi`, `wipo_gii` and `worldbank_doing_business` are pulled
as files on `--live` (a manual drop in `data/manual/<source>/` takes precedence);
`unctadstat` and `imf_weo` are manual drops only. Verified URLs, canonical drop layouts
and quick checks: [step3-manual-drops.md](step3-manual-drops.md). A live `check` aborts
when a selected manual-only source has no drop, so run subsets with `--source`;
`transform` lists absent sources under `missing_sources` and `source_coverage`.
