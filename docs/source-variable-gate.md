# Fuentes descargadas sin variables en el panel (auditoría)

Medición panel ESP · café (HS 0901) · 2024 contra `data/release/internal/CURRENT`
**antes** de los cambios de esta tanda: **26 variables**, 226 candidatos
(`scripts/measure_esp_cafe_panel.py`).

## Una por una

### `imf_weo` (IMF World Economic Outlook)

- **Raw en servidor:** `data/raw/imf_weo/weo-9.0.0/` (~23 636 filas en
  `indicators.csv`; series NGDP_RPCH, PCPIPCH, NGDPDPC, PPPPC, BCA_NGDPD, LUR).
- **Por qué no salían en el panel:** el extract estaba bien; **no había variables
  de catálogo ni paso en `variables_build`** que las fundiera a
  `country_year`.
- **Qué hacemos:** añadir variables WEO_* (draft) y cablearlas en
  `variables_build` (derechos IMF ya con `use_research=yes` y evidencia CA).
- **No** se marca `verified` en nombre de César.

### `hofstede`

- **Raw:** `data/raw/hofstede/hofstede-2015-08-16/dimensions.csv` (62 países × 6
  dimensiones).
- **Variables de catálogo:** CULT, CUDI (`byod_only`; derechos incompletos:
  `redistribute_*` unknown / evidence incompleta).
- **Por qué no salen:** el gate interno exige `ship_*` **o**
  `use_research=yes` + evidencia completa; Hofstede cae en `byod_only` →
  **excluido de la release**. Además CULT/CUDI son bilaterales (origen–destino)
  y hoy `bilateral_year` solo tiene DIST/LANG/FTA.
- **Qué falta (César):** completar derechos en `sources.yaml` / RIGHTS, o usar
  BYOD en el navegador. No inventamos la licencia.

### `kof_globalisation` (GLIN)

- **Raw:** `data/raw/kof_globalisation/kofgi2025-20251219/values.csv` (6 974
  filas, años hasta 2023) — **sí** está en curated wide como columna GLIN.
- **Por qué no está en `country_year` de la release:** gate `byod_only`
  (redistribute_derived unknown / evidence incompleta) → `included: false`.
- **Qué falta (César):** cerrar derechos KOF. Los datos ya están; el bloqueo es
  legal, no técnico.

### `wits_trains` (TARIF / CUTA)

- **Raw:** muestras `col-hs64-*` (XML TRN Colombia HS64), no un
  `tariffs.csv` global origen×destino×HS.
- **Por qué no salen:** (1) gate `byod_only`; (2) el transform espera
  `tariffs.csv` agregado; (3) el pull actual es **COL·HS64**, inútil para
  ESP·café·0901 como arancel bilateral completo.
- **Qué falta:** derechos WITS + extract global (o BYOD). No inventamos aranceles.

### `ecb_fx`

- **Raw:** `data/raw/ecb_fx/ecb-2026-11-20/indicators.csv` (tipos EUR diarios).
- **Por qué no salen:** `BLOCKED_SOURCE_IDS` en app y ETL hasta que César
  confirme `use_research` / redistribución (Prompt 4a). Además es FX por
  **divisa**, no una serie país ISO3 lista para el ranking.
- **Uso previsto:** liquidación Incoterms / precios, no ranking MCDM, cuando se
  desbloquee.

### `vat_rates`

- **Raw:** `data/raw/vat_rates/…` + `data/static/vat_rates.csv` (IVA estándar
  por ISO3, citas nacionales).
- **Por qué no salen:** mismo bloqueo explícito `BLOCKED_SOURCE_IDS` + derechos
  compiled-citations con campos unknown.
- **Uso previsto:** cascada de precio 4P / DDP+IVA, no ranking, tras confirmación.

## EPI / GII / CC (pedir permiso antes de volver a descargar)

Ya hay copias en el servidor; tamaños **Content-Length** comprobados con
`curl -sSIL` (21 nov 2026), sin nueva descarga:

| Qué | Fichero / origen | URL | Tamaño |
| --- | --- | --- | --- |
| **EPI 2026** | `epi2026results2026-07-07.xlsx` | https://epi.yale.edu/sites/default/files/2026-09/epi2026results2026-07-07.xlsx | **460 464** bytes |
| **GII 2026** | `wipo-pub-2000-2026-tech1.xlsx` | https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2026-tech1.xlsx | **943 159** bytes |
| **GII 2025** | `wipo-pub-2000-2025-tech1.xlsx` | https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2025-tech1.xlsx | **935 909** bytes |
| **CC (WGI)** | No es un XLSX único: API World Bank `GOV_WGI_CC.EST` → páginas JSON + `indicators.csv` | API `api.worldbank.org` (conector `worldbank_wgi`) | En disco: `indicators.csv` **723 955** B; pages JSON ~1,4 MB c/u |

**Por qué EPI/GII no entran en el panel 2024 hoy:** en `country_year` el año
guardado es el de **edición** (EPI=2026, GII=2025/2026). El LOCF del proyecto
exige `year <= 2024`, así que se descartan. CC tiene solo 2017 y 2025 (extract
CC.EST incompleto frente a GE.EST).

**Arreglo de código (sin re-descargar):** reetiquetar año de edición → año de
dato (`yale_epi` −2, `wipo_gii` −1) en `variables_build`, y republicar release
interna nueva.
