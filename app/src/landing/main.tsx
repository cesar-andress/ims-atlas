import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LandingApp } from "./LandingApp";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

const rawBase = import.meta.env.BASE_URL || "/";
const basename = rawBase.replace(/\/$/, "") || "/";

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <LandingApp />
    </BrowserRouter>
  </StrictMode>,
);
