import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./i18n";
import "./styles.css";
import { applyTheme, readStoredTheme } from "./theme";

// echarts and maplibre-gl are listed in package.json for later phases.
void import.meta.env;

applyTheme(readStoredTheme());

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

const rawBase = import.meta.env.BASE_URL || "/";
const basename = rawBase.replace(/\/$/, "") || "/";

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
