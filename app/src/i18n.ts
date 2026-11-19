import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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
