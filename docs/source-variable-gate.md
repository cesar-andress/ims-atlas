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
- **Variables de catálogo:** CULT, CUDI (`byod_only`; `use_research=yes`).
- **Gate interno (2026-11-21):** `use_research=yes` basta para incluirlas en la
  release interna. **Siguen fuera del panel** porque CULT/CUDI son bilaterales
  (origen–destino) y `bilateral_year` solo construye DIST/LANG/FTA (no hay
  build Kogut–Singh en ETL todavía).
- **Público:** sigue `byod_only` (no ship).

### `kof_globalisation` (GLIN)

- **Raw:** `data/raw/kof_globalisation/kofgi2025-20251219/values.csv` (años hasta
  2023) — entra en curated wide como GLIN.
- **Gate interno:** con `use_research=yes` debe entrar en `country_year` de la
  release interna tras rebuild. Público: sigue `byod_only`.

### `wits_trains` (TARIF / CUTA)

- **Raw:** muestras `col-hs64-*` (XML TRN Colombia HS64), no un
  `tariffs.csv` global origen×destino×HS.
- **Gate interno:** `use_research=yes` permite incluir TARIF si hubiera datos.
- **Por qué no salen en ESP·café·0901:** el transform espera `tariffs.csv`
  agregado y el pull actual es **COL·HS64**, no arancel bilateral global.

### `ecb_fx`

- **Raw:** `data/raw/ecb_fx/ecb-2026-11-20/indicators.csv` (tipos EUR diarios).
- **use_research:** yes (CA 2026-11-21). Hard block list cleared.
- **Por qué no salen en el panel MCDM:** no hay `variable_id` de catálogo
  país-año; es FX por **divisa** para liquidación Incoterms / precios.
- **Uso:** Incoterms autofill (no ranking).

### `vat_rates`

- **Raw:** `data/raw/vat_rates/…` + `data/static/vat_rates.csv` (IVA estándar
  por ISO3, citas nacionales).
- **use_research:** yes (CA 2026-11-21). Hard block list cleared.
- **Por qué no salen en el panel MCDM:** sin variable de ranking en catálogo;
  tabla de soporte para DDP+IVA / Incoterms.

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
