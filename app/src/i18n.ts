import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./locales/en";
import { parseConfigFromSearch } from "./state/urlState";

type Lang = "en" | "es";
/** Nested message tree (EN/ES string leaves differ; avoid literal-type coupling). */
type Dict = { readonly [key: string]: string | Dict };

type I18nApi = {
  language: Lang;
  t: (key: string) => string;
  changeLanguage: (lang: Lang) => Promise<void>;
};

const I18nContext = createContext<I18nApi | null>(null);

let esBundle: Dict | null = null;
const enDict: Dict = en;

/** Module bridge so callers can await language switches without prop drilling. */
let changeLanguageImpl: ((lang: Lang) => Promise<void>) | null = null;
/** Queued when ensureLanguage runs before the provider mounts its impl. */
let pendingLang: Lang | null = null;

function lookup(dict: Dict, key: string): string {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur !== null && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof cur === "string" ? cur : key;
}

function langFromSearch(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const cfg = parseConfigFromSearch(window.location.search);
    return cfg.lang === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export async function ensureLanguage(lang: Lang): Promise<void> {
  if (lang === "es" && !esBundle) {
    esBundle = (await import("./locales/es")).default;
  }
  if (changeLanguageImpl) {
    await changeLanguageImpl(lang);
    pendingLang = null;
    return;
  }
  pendingLang = lang;
}

export function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const bootLang = initialLang ?? langFromSearch();
  const [language, setLanguage] = useState<Lang>(bootLang);
  const [, setEsReady] = useState(0);

  const changeLanguage = useCallback(async (lang: Lang) => {
    if (lang === "es" && !esBundle) {
      esBundle = (await import("./locales/es")).default;
      setEsReady((n) => n + 1);
    }
    setLanguage(lang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, []);

  useEffect(() => {
    changeLanguageImpl = changeLanguage;
    const queued = pendingLang;
    pendingLang = null;
    if (queued) {
      void changeLanguage(queued);
    } else if (bootLang === "es") {
      void changeLanguage("es");
    }
    return () => {
      changeLanguageImpl = null;
    };
  }, [bootLang, changeLanguage]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const dict = language === "es" && esBundle ? esBundle : enDict;

  const value = useMemo<I18nApi>(
    () => ({
      language,
      t: (key: string) => lookup(dict, key),
      changeLanguage,
    }),
    [language, dict, changeLanguage],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

/** Drop-in replacement for react-i18next's useTranslation (subset used by the app). */
export function useTranslation(): {
  t: (key: string) => string;
  i18n: { language: string; changeLanguage: (lang: Lang) => Promise<void> };
} {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation requires I18nProvider");
  }
  return {
    t: ctx.t,
    i18n: {
      language: ctx.language,
      changeLanguage: ctx.changeLanguage,
    },
  };
}
