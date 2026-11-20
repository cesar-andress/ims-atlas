export type LandingLang = "es" | "en";

const copy = {
  es: {
    brand: "IMS Atlas",
    navMethod: "Metodología",
    navEnter: "Entrar (equipo)",
    navPrivacy: "Privacidad",
    navLegal: "Aviso legal",
    heroTitle: "IMS Atlas: selección de mercados internacionales con método científico",
    heroSub:
      "Herramienta desarrollada en España que aplica una metodología multicriterio publicada y revisada por pares para decidir a qué mercados exportar.",
    heroCta: "Entrar (equipo)",
    heroSecondary: "Ver la metodología",
    howTitle: "Cómo funciona",
    how1Title: "Datos",
    how1Body:
      "Comercio internacional (BACI) y fuentes oficiales: Banco Mundial, CEPII, OMC y otras series publicadas.",
    how2Title: "Variables y pesos",
    how2Body:
      "Criterios y subcriterios ponderados por expertos con el proceso analítico jerárquico (AHP).",
    how3Title: "Resultados",
    how3Body:
      "Ranking de mercados, matriz de atractivo frente a apertura, mapa y comparación entre países.",
    howCaption:
      "Vista de la herramienta (acceso del equipo): ranking y matriz con marca de agua del proyecto.",
    methodTitle: "Metodología",
    methodBody:
      "IMS Atlas aplica la técnica multicriterio híbrida para selección de mercados internacionales desarrollada por Baena-Rojas y coautores desde 2018. El método combina una preselección por importaciones, criterios y subcriterios ponderados por expertos (AHP), normalización de indicadores, una suma ponderada del atractivo y una matriz estratégica frente a la apertura comercial. Se ha aplicado a bebidas carbonatadas, productos químicos, textil, pymes y bienes en general. La herramienta digitaliza ese flujo con datos actualizados y proyectos guardados en el navegador del usuario.",
    pubsTitle: "Publicaciones",
    teamTitle: "Equipo",
    teamNames: "César Andrés-Sánchez, Jose Jaime Baena-Rojas, José Alejandro Cano",
    teamAffil: "[AFILIACIONES: pendiente César]",
    footerDev: "Desarrollado por AISERV SYSTEMS SLU (Madrid, España)",
    loginHint: "Inicia sesión para acceder",
    themeLight: "Claro",
    themeDark: "Oscuro",
    methodPageTitle: "Metodología IMS",
    methodPageLead:
      "Pasos del método, fórmulas en texto plano y las publicaciones de referencia.",
    privacyTitle: "Privacidad",
    legalTitle: "Aviso legal",
  },
  en: {
    brand: "IMS Atlas",
    navMethod: "Methodology",
    navEnter: "Sign in (team)",
    navPrivacy: "Privacy",
    navLegal: "Legal notice",
    heroTitle: "IMS Atlas: international market selection with a scientific method",
    heroSub:
      "A tool developed in Spain that applies a peer-reviewed multicriteria methodology to decide which markets to export to.",
    heroCta: "Sign in (team)",
    heroSecondary: "View the methodology",
    howTitle: "How it works",
    how1Title: "Data",
    how1Body:
      "International trade (BACI) and official sources: World Bank, CEPII, WTO and other published series.",
    how2Title: "Variables and weights",
    how2Body:
      "Criteria and sub-criteria weighted by experts with the Analytic Hierarchy Process (AHP).",
    how3Title: "Results",
    how3Body:
      "Market ranking, attractiveness-versus-openness matrix, map and country comparison.",
    howCaption:
      "Tool view (team access): ranking and matrix with the project watermark.",
    methodTitle: "Methodology",
    methodBody:
      "IMS Atlas applies the hybrid multicriteria technique for international market selection developed by Baena-Rojas and co-authors since 2018. The method combines import-based preselection, expert-weighted criteria and sub-criteria (AHP), indicator normalisation, a weighted attractiveness score and a strategic matrix against trade openness. It has been applied to carbonated beverages, chemicals, textiles, SMEs and goods in general. The tool digitises that flow with updated data and projects stored in the user's browser.",
    pubsTitle: "Publications",
    teamTitle: "Team",
    teamNames: "César Andrés-Sánchez, Jose Jaime Baena-Rojas, José Alejandro Cano",
    teamAffil: "[AFFILIATIONS: pending César]",
    footerDev: "Developed by AISERV SYSTEMS SLU (Madrid, Spain)",
    loginHint: "Sign in to access",
    themeLight: "Light",
    themeDark: "Dark",
    methodPageTitle: "IMS methodology",
    methodPageLead: "Method steps, plain-text formulas and reference publications.",
    privacyTitle: "Privacy",
    legalTitle: "Legal notice",
  },
} as const;

export type LandingCopy = { [K in keyof (typeof copy)["es"]]: string };

export function landingCopy(lang: LandingLang): LandingCopy {
  return copy[lang] as LandingCopy;
}

export function readLandingLang(): LandingLang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "es") return q;
    const stored = localStorage.getItem("ims-atlas.landing-lang");
    if (stored === "en" || stored === "es") return stored;
  } catch {
    /* ignore */
  }
  return "es";
}

export function storeLandingLang(lang: LandingLang): void {
  try {
    localStorage.setItem("ims-atlas.landing-lang", lang);
  } catch {
    /* ignore */
  }
}
