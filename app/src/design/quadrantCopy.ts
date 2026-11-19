/**
 * Quadrant descriptions + strategies copied verbatim from Jose's IMSFE workbook
 * sheets "Cruce Inglés" / "Cruce Español" (read-only extract 2026-11-19).
 * Do not paraphrase.
 */
import type { ImsfeEocQuadrant } from "@ims-atlas/core";

export type QuadrantCopy = {
  description: string;
  strategy: string;
};

const EN: Record<ImsfeEocQuadrant, QuadrantCopy> = {
  1: {
    description:
      "Markets with high economic openness, offering very favorable structural, logistical, and commercial conditions for exports. They are often characterized by a favorable evaluation in terms of market saturation. Generally possess robust infrastructure, streamlined bureaucracy, and a well-established business environment. These markets tend to have high levels of competition, which necessitates the offering of value-added products. The market has high expectations for quality and regulatory compliance.",
    strategy:
      "Prioritize as primary target markets, with fast scaling. Establish permanent export operations and strategic alliances with distributors and e-commerce platforms. Introduce products with higher added value or with differential design. Rely on trade agreements and free trade zones. Invest in branding and product differentiation to stand out in sophisticated markets.",
  },
  4: {
    description:
      "Less economically open, but with good internal conditions to operate due to economic stability, high purchasing power and consumer sophistication. May require special strategies such as local partnerships or digital channels. Markets with low operating volumes compared to other markets, but high profit margins by overcoming the barrier to entry.",
    strategy:
      "Generate medium to long-term relationships through joint ventures, local production, commercial offices, or bilateral agreements. Implement a selective entry strategy, complemented by recognition campaigns or local alliances. The company should also consider offering premium, ecological, or uniquely designed products. Leverage existing bilateral treaties to ensure a strong and mutually beneficial business relationship.",
  },
  2: {
    description:
      "Markets that exhibit optimal trade openness yet remain underpenetrated. A gradual entry strategy is imperative, accompanied by cultural and logistical adaptation. These markets may present challenges related to infrastructure, political risk, or economic factors, necessitating constant monitoring. The emergence of non-tariff barriers or specific technical requirements is a distinct possibility. The presence of less direct competition is counterbalanced by an increase in overall uncertainty.",
    strategy:
      "Tactical entry, secondary products, or low-risk models. Explore options that are both low-risk and high-flexibility. Focus your efforts on building strong relationships with local distributors. Exporting indirectly or using intermediaries can reduce initial risks. Look for opportunities in new groups of consumers. Promote products with campaigns that highlight their quality and design.",
  },
  3: {
    description:
      "Markets characterized by low economic openness and less favorable domestic conditions. A cost-benefit analysis should be conducted to determine the viability of investment in their development. Often characterized by the presence of significant barriers, both tariff and non-tariff, which create substantial obstacles for new entrants. It could include regulatory, political, and cultural factors. Investors may need to adapt to local regulations and preferences, which can generate significant investment costs before market entry.",
    strategy:
      "Enter these markets only if the company has a clear competitive advantage or strategic opportunity. Think about working with local partners who have experience exporting. Evaluate licensing strategies or joint ventures. Focus on understanding the market and following all the rules.",
  },
};

const ES: Record<ImsfeEocQuadrant, QuadrantCopy> = {
  1: {
    description:
      "Mercados con alta apertura comercial, con condiciones estructurales, logísticas y comerciales muy favorables para la exportación. Evaluación favorable en cuanto a saturación de mercado. Suelen tener buena infraestructura, baja burocracia, y un entorno empresarial maduro. Representan un mercado con alto potencial para expansión y alianzas estratégicas con distribuidores y ecommerces. Alta competencia, se requiere productos de valor agregado. Mercado con expectativas altas de calidad y cumplimiento normativo.",
    strategy:
      "Priorizar como mercados objetivo primarios, con escalamiento rápido. Establecer operaciones de exportación permanentes o con representaciones locales. Introducir productos de mayor valor agregado o con diseño diferencial. Apoyarse en acuerdos comerciales y zonas francas. Invertir en branding y diferenciación del producto para destacar en mercados sofisticados. Participar en ferias y eventos sectoriales de alto nivel.",
  },
  4: {
    description:
      "Menor economic openness, pero con buenas condiciones internas para operar a través de estabilidad económica, poder adquisitivo alto y sofisticación del consumidor. Pueden requerir de estrategias específicas como asociaciones locales o canales digitales. Mercados con volumen de operación bajo en contraste con otros mercados, pero de alto margen de utilidad al superar la barrera de entrada.",
    strategy:
      "Generar relaciones de mediano plazo a largo plazo a través de Joint ventures, producción local, oficinas comerciales o acuerdos bilaterales. Estrategia de entrada selectiva con campañas de reconocimiento o alianzas locales. Oferta selectiva de productos premium, ecológicos o de diseño único. Aprovechar tratados bilaterales existentes.",
  },
  2: {
    description:
      "Mercados con buena apertura comercial pero aún baja penetración. Requieren estrategia de entrada gradual y adaptación cultural/logística. Pueden presentar desafíos en términos de infraestructura, riesgo político o factores económicos, por lo que deben monitorearse constantemente. Pueden surgir barreras no arancelarias o requerimientos técnicos específicos. Menor competencia directa, pero más incertidumbre.",
    strategy:
      "Entrada táctica, productos secundarios o modelos de bajo riesgo. Explorar con bajo riesgo y alta flexibilidad. Enfocar esfuerzos en alianzas estratégicas con distribuidores locales. Exportación indirecta o intermediada para reducir riesgos iniciales. Analizar oportunidades en segmentos nicho de consumo emergente. Acompañar con campañas de promoción sobre calidad/diseño del producto.",
  },
  3: {
    description:
      "Mercados con baja apertura y condiciones internas menos favorables. Suelen tener menor prioridad, y debe evaluarse si vale la pena invertir en desarrollo de dicho mercado. Suelen presenta barreras altas (arancelarias y no arancelarias) y condiciones menos favorables para nuevos entrantes. Esto incluye riesgos regulatorios, políticos o culturales. Pueden requerir adaptación a normativas y gustos locales, generando una inversión significativa para entrar.",
    strategy:
      "Entrar a estos mercados solo si hay una ventaja competitiva clara u oportunidad estratégica. Considerar la exportación con socios locales de experiencia probada. Evaluar estrategias de licenciamiento o joint ventures. Priorizar inteligencia de mercado y cumplimiento regulatorio exhaustivo.",
  },
};

export function quadrantCopy(q: ImsfeEocQuadrant, lang: "en" | "es"): QuadrantCopy {
  return lang === "es" ? ES[q] : EN[q];
}
