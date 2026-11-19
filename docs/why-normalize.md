# ¿Por qué normalizar?

Variables de selección de mercados viven en escalas distintas (USD, %, índices 1–5, km),
suelen estar sesgadas (importaciones, PIB, distancia) y a menudo miden ideas parecidas
(PIB per cápita, LPI, gobernanza). Sin un paso de normalización explícito, una sola
variable puede dominar el índice o la misma idea puede contarse dos veces.

IMS Atlas aplica un **pipeline por variable** en este orden fijo (cada paso es opcional):

1. **Armonización de unidades** (catálogo): USD constante vs corriente, per cápita, etc.
2. **Sesgo**: `none` / `log` / `log1p` (útil en colas largas positivas).
3. **Outliers**: `none` / winsor p1–p99 / winsor p5–p95 (las celdas afectadas se marcan).
4. **Escala**: ratio 0–10 (IMSFE), min–max 0–10, z-score, robust z (mediana/MAD), rank.
5. **Dirección** (beneficio/coste) **después** de escalar, nunca antes.

## Ejemplo trabajado

Serie cruda (beneficio): `[1, 2, 10]`.

| Método | Resultado (aprox.) | Cuándo usarlo |
|--------|--------------------|---------------|
| ratio 0–10 | `[1, 2, 10]` | IMSFE / DMP: máximo → 10 |
| min–max 0–10 | `[0, 1.11, 10]` | Acotar al rango observado |
| z-score | centrado en media | Comparar desviaciones típicas |
| robust z | centrado en mediana | Outliers fuertes |
| rank | percentiles 0–10 | Solo importa el orden |

Si la variable es **coste** (p. ej. distancia), tras min–max se refleja: el peor valor
pasa a 0 y el mejor a 10.

## Conjunto de referencia

Las estadísticas (min, max, media, MAD) pueden calcularse sobre:

- **candidatos** del análisis (por defecto),
- **todos los países** del release, o
- un **año base** fijo.

Por rangos temporales: **por año** (comparable dentro del año) o **agrupado** (necesario
para tendencias entre años). La UI indica cuál está activo.

## Correlación y doble conteo

Si dos variables elegidas tienen \|ρ\| ≥ 0.8, el laboratorio avisa
(“miden casi lo mismo: estás contando dos veces”). La opción avanzada
**decorrelacionar** (whitening / Mahalanobis) está **apagada por defecto** porque
cambia el significado de los pesos del método de Jose.

## Laboratorio

La vista **Norm lab** muestra histogramas antes/después, top/bottom 5 tras cada paso,
y un ranking lado a lado bajo dos normalizaciones (Spearman y solape top-10).
