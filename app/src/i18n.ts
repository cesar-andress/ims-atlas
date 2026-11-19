import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

/** Lazy-load Spanish bundle on first switch (keeps EN first paint smaller). */
export async function ensureLanguage(lang: "en" | "es"): Promise<void> {
  if (lang === "es" && !i18n.hasResourceBundle("es", "translation")) {
    const mod = await import("./locales/es");
    i18n.addResourceBundle("es", "translation", mod.default, true, true);
  }
  await i18n.changeLanguage(lang);
}

export default i18n;
