/**
 * The ranking engine emits plain-English warning strings. Translate them for the
 * Spanish UI (pattern-based, so dynamic numbers/ids are kept). Unknown strings
 * pass through unchanged.
 */
type Rule = [RegExp, (m: RegExpMatchArray) => string];

const ES_RULES: Rule[] = [
  [
    /^Example panel is (\w+)-only; using \1\.$/,
    (m) => `El ejemplo solo tiene origen ${m[1]}; se usa ${m[1]}.`,
  ],
  [
    /^Demo panel year is (\d+); requested (\d+)\.$/,
    (m) => `El ejemplo es del año ${m[1]}; pediste ${m[2]}.`,
  ],
  [/^Criteria tree: (.+)$/, (m) => `Árbol de criterios: ${m[1]}`],
  [
    /^HS-6 code has only (\d+) reporting importers \(threshold (\d+)\)$/,
    (m) => `El código HS-6 solo tiene ${m[1]} importadores con datos (mínimo ${m[2]}).`,
  ],
  [
    /^Pre-selection uses demo-panel import proxies \(BACI trade parquet not loaded\)\.$/,
    () =>
      "La preselección usa importaciones aproximadas del ejemplo (datos de comercio BACI no cargados).",
  ],
  [
    /^Pre-selection import shares from BACI release trade chapter\.$/,
    () => "La preselección usa cuotas de importación de BACI (capítulo HS).",
  ],
  [
    /^Pre-selection (\S+): (\d+) markets$/,
    (m) => `Preselección (${m[1]}): ${m[2]} mercados`,
  ],
  [
    /^Pre-selection left (\d+) destinations \(<20\); keeping prior filter \((\d+)\)\.$/,
    (m) =>
      `La preselección dejaba ${m[1]} destinos (menos de 20); se mantiene el filtro anterior (${m[2]}).`,
  ],
  [
    /^Candidate filter left (\d+) destinations; demo requires ≥20, using full set\.$/,
    (m) =>
      `El filtro dejaba ${m[1]} destinos; se necesitan al menos 20, así que se usan todos.`,
  ],
  [
    /^Tree variables not in panel \(skipped\): (.+)$/,
    (m) => `Variables del árbol sin datos en el panel (no usadas): ${m[1]}`,
  ],
  [
    /^No tree variables available; falling back to panel variables\.$/,
    () => "Ninguna variable del árbol tiene datos; se usan las variables del panel.",
  ],
  [
    /^Using (\d+) panel variables mapped from criteria tree$/,
    (m) => `Se usan ${m[1]} variables del panel asignadas al árbol de criterios.`,
  ],
  [/^Zero policy: (.+)$/, (m) => `Tratamiento de ceros: ${m[1]}`],
  [
    /^Cultural distance kind=(\S+): .+$/,
    (m) =>
      `Distancia cultural (${m[1]}): se usa la columna del libro (suma de sumas); no se recalcula Hofstede sin las dimensiones.`,
  ],
  [
    /^Imputation method=(\S+) needs multi-year series; residual gaps use column median\.$/,
    (m) =>
      `El método de imputación ${m[1]} necesita series de varios años; los huecos se rellenan con la mediana.`,
  ],
  [
    /^Combined score a·EOC\+\(1−a\)·IMSFE with a=(.+)$/,
    (m) => `Puntuación combinada a·EOC+(1−a)·IMSFE con a=${m[1]}`,
  ],
  [
    /^Combined score skipped: fewer than 5 EOC values in panel\.$/,
    () => "Puntuación combinada omitida: menos de 5 valores de apertura (EOC).",
  ],
  [/^Excluded for missingness: (.+)$/, (m) => `Excluidas por falta de datos: ${m[1]}`],
  [/^Median-imputed cells: (\d+)$/, (m) => `Celdas rellenadas con la mediana: ${m[1]}`],
  [
    /^No variables left after restricting weights$/,
    () =>
      "Los pesos manuales no coinciden con los factores del panel. Elige Pesos de expertos o vuelve a ajustar los pesos.",
  ],
  [
    /^No overlapping factors between weights and matrix$/,
    () =>
      "Los pesos y las variables no comparten factores. Restablece los pesos de expertos e inténtalo de nuevo.",
  ],
];

export function localizeWarning(message: string, lang: string): string {
  if (!lang.startsWith("es")) return message;
  for (const [re, fmt] of ES_RULES) {
    const m = message.match(re);
    if (m) return fmt(m);
  }
  return message;
}
