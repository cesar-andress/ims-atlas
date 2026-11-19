import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const nav = {
  en: {
    home: "Home",
    catalog: "Data catalog",
    builder: "Index builder",
    ranking: "Ranking",
    matrix: "Strategic matrix",
    map: "Market map",
    uncertainty: "Uncertainty",
    backtest: "Backtest",
    time: "Time explorer",
    cite: "Cite & export",
    byod: "BYOD",
    docs: "Docs",
  },
  es: {
    home: "Inicio",
    catalog: "Catálogo de datos",
    builder: "Constructor",
    ranking: "Ranking",
    matrix: "Matriz estratégica",
    map: "Mapa de mercados",
    uncertainty: "Incertidumbre",
    backtest: "Backtest",
    time: "Explorador temporal",
    cite: "Citar y exportar",
    byod: "BYOD",
    docs: "Documentación",
  },
} as const;

const resources = {
  en: {
    translation: {
      appName: "IMS Atlas",
      tagline:
        "Build, compare, stress-test and backtest international market selection indices.",
      home: "Home",
      language: "Language",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      statusNote: "In development — first public version coming soon",
      dataRelease: "Data release",
      footerCredit:
        "Developed within the R&D&I project [project name/code] of AISERV SYSTEMS SLU (Madrid, Spain).",
      footerRepo: "GitHub repository",
      footerBacktest: "ims-backtest",
      mainNav: "Main",
      configPanel: "Analysis config",
      origin: "Origin",
      year: "Year",
      normalization: "Normalisation",
      method: "Method",
      saveProject: "Save",
      exportProject: "Export JSON",
      importProject: "Import JSON",
      examplePermalinks: "Example permalinks",
      catalogIntro: "Variables by factor with licence badges and coverage heatmaps.",
      permalinkState: "Permalink config",
      loading: "Loading…",
      status: "Status",
      coverage: "Coverage",
      selectVariable: "Select a variable",
      stubSoon: "This view arrives in a later phase.",
      nav: nav.en,
    },
  },
  es: {
    translation: {
      appName: "IMS Atlas",
      tagline:
        "Construye, compara, estresa y valida índices de selección de mercados internacionales.",
      home: "Inicio",
      language: "Idioma",
      theme: "Tema",
      themeLight: "Claro",
      themeDark: "Oscuro",
      statusNote: "En desarrollo — la primera versión pública estará disponible pronto",
      dataRelease: "Publicación de datos",
      footerCredit:
        "Developed within the R&D&I project [project name/code] of AISERV SYSTEMS SLU (Madrid, Spain).",
      footerRepo: "Repositorio en GitHub",
      footerBacktest: "ims-backtest",
      mainNav: "Principal",
      configPanel: "Configuración",
      origin: "Origen",
      year: "Año",
      normalization: "Normalización",
      method: "Método",
      saveProject: "Guardar",
      exportProject: "Exportar JSON",
      importProject: "Importar JSON",
      examplePermalinks: "Permalinks de ejemplo",
      catalogIntro: "Variables por factor con licencias y mapas de cobertura.",
      permalinkState: "Config del permalink",
      loading: "Cargando…",
      status: "Estado",
      coverage: "Cobertura",
      selectVariable: "Selecciona una variable",
      stubSoon: "Esta vista llegará en una fase posterior.",
      nav: nav.es,
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
