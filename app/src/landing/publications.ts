/**
 * Peer-reviewed IMS methodology publications (landing + in-app cite).
 * DOIs only when present on the publisher page / stable URL — never invented.
 */

export type LandingPublication = {
  id: string;
  authors: string;
  year: number;
  title: string;
  venue: string;
  url: string;
  /** Include only when verified on the publisher record. */
  doi?: string;
};

export const LANDING_PUBLICATIONS: LandingPublication[] = [
  {
    id: "dyo-2018",
    authors: "Rojas, J. J. B., Rojas, J. A., & Campo, E. A.",
    year: 2018,
    title:
      "Metodología para la selección de mercados internacionales: Un análisis de caso para la exportación de bebidas carbonatadas",
    venue: "Dirección y Organización, 5-16",
    url: "https://revistadyo.es/DyO/index.php/dyo/article/view/532/553",
  },
  {
    id: "infotec-2020",
    authors: "López-Cadavid, D. A., Vanegas-López, J. G., & Baena-Rojas, J. J.",
    year: 2020,
    title:
      "Aplicación de un método multicriterio en la enseñanza de la investigación de mercados internacionales",
    venue: "Información tecnológica, 31(1), 113-122",
    url: "https://www.semanticscholar.org/reader/70ac1f29bc67a9bae83f517560cec12813f1577f",
  },
  {
    id: "labr-2021",
    authors: "Baena-Rojas, J. J., Vanegas-López, J. G., & López-Cadavid, D. A.",
    year: 2021,
    title: "Determining factors in the choice of export markets for chemical products",
    venue: "Latin American Business Review, 22(2), 107-130",
    url: "https://www.tandfonline.com/doi/abs/10.1080/10978526.2020.1827414",
    doi: "10.1080/10978526.2020.1827414",
  },
  {
    id: "ribs-2021",
    authors:
      "Vanegas-López, J. G., Baena-Rojas, J. J., López-Cadavid, D. A., & Mathew, M.",
    year: 2021,
    title:
      "International market selection: an application of hybrid multi-criteria decision-making technique in the textile sector",
    venue: "Review of International Business and Strategy, 31(1), 127-150",
    url: "https://www.emerald.com/insight/content/doi/10.1108/ribs-07-2020-0088/full/html",
    doi: "10.1108/ribs-07-2020-0088",
  },
  {
    id: "ram-2022",
    authors:
      "Baena-Rojas, J. J., López-Cadavid, D. A., Mackenzie-Torres, T. M., & Muñoz-Parra, C. L.",
    year: 2022,
    title:
      "Hybrid multicriteria technique for international markets selection based on the analytic hierarchy process",
    venue: "RAM. Revista de Administração Mackenzie, 23(2), eRAMR220038",
    url: "https://www.scielo.br/j/ram/a/Rk76XmwHHgmQFDCZrggDqMx/?format=pdf&lang=en",
  },
  {
    id: "pjms-2023",
    authors:
      "Baena-Rojas, J. J., Mackenzie-Torres, T. M., Cuesta-Giraldo, G., & Tabares, A.",
    year: 2023,
    title:
      "A hybrid multi-criteria decision-making technique for international market selection in SMEs",
    venue: "Polish Journal of Management Studies, 27",
    url: "https://pjms.zim.pcz.pl/article/01.3001.0053.7015/en",
  },
  {
    id: "gbr-2026",
    authors: "Baena-Rojas, J. J., & Cano, J. A.",
    year: 2026,
    title:
      "International Market Selection for Exports of Goods: A Data Analysis Technique for Organizational Decision-making",
    venue: "Global Business Review, 09721509261464305",
    url: "https://journals.sagepub.com/doi/abs/10.1177/09721509261464305",
    doi: "10.1177/09721509261464305",
  },
];

export function formatPublicationApa(p: LandingPublication): string {
  const doi = p.doi ? ` https://doi.org/${p.doi}` : "";
  return `${p.authors} (${p.year}). ${p.title}. ${p.venue}.${doi}`;
}
