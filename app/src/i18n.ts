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
      placeholder: "Scaffold only — index builder and data views land in later phases.",
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
      placeholder:
        "Solo andamiaje — el constructor de índices y las vistas de datos llegan en fases posteriores.",
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
