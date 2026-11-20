import { ensureLanguage, saveLanguagePreference, useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

const LANGS = [
  { id: "es", label: "ES" },
  { id: "en", label: "EN" },
] as const;

/** Visible ES / EN switch: writes config.lang, loads the bundle, remembers the choice. */
export function LangSwitch() {
  const { t, i18n } = useTranslation();
  const { setLang } = useAnalysis();
  const current = i18n.language.startsWith("es") ? "es" : "en";

  function choose(lang: "es" | "en") {
    if (lang === current) return;
    saveLanguagePreference(lang);
    void ensureLanguage(lang).then(() => setLang(lang));
  }

  return (
    <div
      className="lang-switch"
      role="group"
      aria-label={t("language")}
      data-testid="lang-switch"
    >
      {LANGS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="lang-switch-btn"
          aria-pressed={current === id}
          data-testid={`lang-${id}`}
          onClick={() => choose(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
