import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { I18nProvider, preloadBootLanguage } from "./i18n";
import "./design/tokens.css";
import "./index.tw.css";
import "./styles.css";
import { applyTheme, readStoredTheme } from "./theme";

void import.meta.env;

applyTheme(readStoredTheme());

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

const rawBase = import.meta.env.BASE_URL || "/";
const basename = rawBase.replace(/\/$/, "") || "/";

void preloadBootLanguage().then((initialLang) => {
  createRoot(root).render(
    <StrictMode>
      <I18nProvider initialLang={initialLang}>
        <BrowserRouter basename={basename}>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </StrictMode>,
  );
});
