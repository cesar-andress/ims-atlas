# Step 3 sources: automatic fetch vs manual drop

Status as of 2026-11-20. URLs below were opened with `curl` in that session; nothing
here is a guess. Files fetched or dropped stay under gitignored `data/raw/` and
`data/manual/` and are never committed. This ETL never writes `rights`, `checked_by`
or `verified`.

| Source | Mode | What `--live` does | Manual drop (wins over the network) |
|---|---|---|---|
| `inform_risk` | auto | HDX `package_show` probe, then `inform_risk_index_trends.csv` (`IndicatorId == INFORM`) | `data/manual/inform_risk/values.csv` |
| `transparency_cpi` | auto | HEAD probe, then `CPI2025_Results.xlsx` (sheet `CPI Timeseries ...`) | `data/manual/transparency_cpi/values.csv` |
| `wipo_gii` | auto | HEAD probe, then the GII 2026 and GII 2025 database XLSX (`Data` sheet, overall score) | `data/manual/wipo_gii/values.csv` |
| `worldbank_doing_business` | auto | HEAD probe, then `DB_CSV.zip` (four headline series) | `data/manual/worldbank_doing_business/indicators.csv` |
| `unctadstat` | manual only | none (no public bulk endpoint verified) | `data/manual/unctadstat/indicators.csv` |
| `imf_weo` | manual only (cerrada store only) | none (SDMX URL returned 404; IMF pages return 403 to `curl`) | `data/manual/imf_weo/indicators.csv` |

Canonical drop layouts: `values.csv` = `iso3,year,value` (or `country_name` instead of
`iso3`, mapped through the allow-list in `iso3.py`); `indicators.csv` =
`iso3,year,indicator,value`. Each folder's `README.md` has the exact URLs, the optional
pin file, and the rules. Without a drop, a manual-only source is reported by
`transform` in `missing_sources` (and in `source_coverage`) with the README path as the
reason; a live `check` for it exits 2.

## Verified URLs

Automatic:

- `transparency_cpi`: <https://files.transparencycdn.org/images/CPI2025_Results.xlsx>
  (HTTP 200, about 3 MB). `CPI2024_Results.xlsx` answered 403, so it is not configured.
- `inform_risk`:
  <https://data.humdata.org/api/3/action/package_show?id=f5ec2ee7-8a1b-49b4-864b-70bdb582a022>
  and
  <https://data.humdata.org/dataset/f5ec2ee7-8a1b-49b4-864b-70bdb582a022/resource/b1d4a203-ef6e-44f7-9895-17c127aeaaee/download/inform_risk_index_trends.csv>
  (302 to object storage, then 200). The file named in the original brief,
  `inform_risk_index.csv`, is an indicator-level table with blank indicator names and no
  overall-risk row, so the sibling trends file is used instead.
- `wipo_gii`: <https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2026-tech1.xlsx> and
  <https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2025-tech1.xlsx>, read from
  <https://www.wipo.int/publications/en/details.jsp?id=4873> and
  <https://www.wipo.int/publications/en/details.jsp?id=4807>.
- `worldbank_doing_business`: <https://databank.worldbank.org/data/download/DB_CSV.zip>
  (301 to `databankfiles.worldbank.org`, then 200), linked from
  <https://datacatalog.worldbank.org/search/dataset/0038564/doing-business>.

Manual only:

- `unctadstat`: <https://unctadstat.unctad.org/datacentre/dataviewer/US.TradeMerchTotal>
  (200; single-page application backed by a private, sign-in API) and terms
  <https://unctadstat.unctad.org/EN/About.html>.
- `imf_weo`: <https://data.imf.org/datasets/WEO> and
  <https://www.imf.org/en/Publications/WEO> (both 403 to `curl`: open in a browser).
  Terms: <https://www.imf.org/en/about/copyright-and-terms> (403 to `curl`).

## Quick checks

```bash
cd etl
# offline (recorded-shape fixtures, no network)
uv run pytest tests/test_step3_connectors.py -q
uv run atlas-etl run --fixture-root tests/fixtures/mini_world

# live, auto-fetch sources only (writes under data/raw/, never committed)
uv run atlas-etl check   --source inform_risk,transparency_cpi,wipo_gii,worldbank_doing_business
uv run atlas-etl extract --source inform_risk,transparency_cpi,wipo_gii,worldbank_doing_business
uv run atlas-etl validate --source inform_risk,transparency_cpi,wipo_gii,worldbank_doing_business
```

`year` semantics: INFORM = edition year (`GNAYear`); CPI = CPI year; GII = edition year;
Doing Business = the year column of `DBData.csv`. Edition-year labels are not
observation years; keep that in mind for the "time t uses data with year <= t" rule.
