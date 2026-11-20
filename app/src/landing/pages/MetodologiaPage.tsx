import { LANDING_PUBLICATIONS, formatPublicationApa } from "../publications";
import type { LandingCopy, LandingLang } from "../i18n";

const FLOW = {
  es: [
    "Preselección de mercados según el volumen de importaciones del producto.",
    "Definición de criterios y subcriterios (coste, logística, comercial, económico, político, cultura) y pesos de expertos con AHP.",
    "Normalización de cada indicador a una escala comparable.",
    "Suma ponderada para obtener el índice de atractivo de cada mercado.",
    "Matriz estratégica: atractivo frente a apertura comercial, para orientar la decisión.",
  ],
  en: [
    "Preselect markets by import volume for the product.",
    "Define criteria and sub-criteria (cost, logistics, commercial, economic, political, culture) and expert weights with AHP.",
    "Normalise each indicator to a comparable scale.",
    "Weighted sum for each market attractiveness index.",
    "Strategic matrix: attractiveness versus trade openness to guide the decision.",
  ],
} as const;

const FORMULAS = {
  es: [
    "Peso de un criterio: media geométrica de los juicios AHP del panel, normalizada para que sume 1.",
    "Indicador normalizado (más es mejor): (valor − mínimo) / (máximo − mínimo) en el conjunto de mercados del año.",
    "Indicador normalizado (menos es mejor): (máximo − valor) / (máximo − mínimo).",
    "Índice de atractivo = suma de (peso del criterio × indicador normalizado).",
  ],
  en: [
    "Criterion weight: geometric mean of the panel AHP judgements, normalised to sum to 1.",
    "Normalised indicator (higher is better): (value − min) / (max − min) across markets in the year.",
    "Normalised indicator (lower is better): (max − value) / (max − min).",
    "Attractiveness index = sum of (criterion weight × normalised indicator).",
  ],
} as const;

export function MetodologiaPage({
  copy,
  lang,
}: {
  copy: LandingCopy;
  lang: LandingLang;
}) {
  return (
    <article className="l-section l-wrap" data-testid="metodologia-page">
      <h1>{copy.methodPageTitle}</h1>
      <p className="l-prose">{copy.methodPageLead}</p>

      <h2>{lang === "es" ? "Flujo del método" : "Method flow"}</h2>
      <ol className="l-prose">
        {FLOW[lang].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <figure className="l-shot" aria-label="Diagrama del flujo">
        <svg viewBox="0 0 900 160" xmlns="http://www.w3.org/2000/svg" role="img">
          <rect width="900" height="160" fill="transparent" />
          {(lang === "es"
            ? ["Datos", "Pesos AHP", "Normalizar", "Índice", "Matriz"]
            : ["Data", "AHP weights", "Normalise", "Index", "Matrix"]
          ).map((label, i) => {
            const x = 30 + i * 170;
            return (
              <g key={label}>
                <rect x={x} y="50" width="140" height="56" rx="10" fill="#0f766e" />
                <text
                  x={x + 70}
                  y="84"
                  textAnchor="middle"
                  fill="#fff"
                  fontFamily="Inter,sans-serif"
                  fontSize="14"
                  fontWeight="600"
                >
                  {label}
                </text>
                {i < 4 ? (
                  <path
                    d={`M ${x + 145} 78 L ${x + 165} 78`}
                    stroke="#94a3b8"
                    strokeWidth="2"
                    markerEnd="url(#arrow)"
                  />
                ) : null}
              </g>
            );
          })}
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>
      </figure>

      <h2>{lang === "es" ? "Fórmulas principales" : "Main formulas"}</h2>
      <ul className="l-prose">
        {FORMULAS[lang].map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <h2>{copy.pubsTitle}</h2>
      <ol className="l-pubs">
        {LANDING_PUBLICATIONS.map((p) => (
          <li key={p.id}>
            <a href={p.url} rel="noopener noreferrer" target="_blank">
              {p.title}
            </a>
            <span className="l-meta">{formatPublicationApa(p)}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}
