import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShellFrame } from "./components/AppChrome";
import { Home } from "./pages/Home";
import { AnalysisProvider } from "./state/AnalysisContext";
import { useAnalysis } from "./state/useAnalysis";
import { isAnalysisView } from "./state/views";
import { useTranslation } from "./i18n";

const ConfigPanel = lazy(() =>
  import("./components/ConfigPanel").then((m) => ({ default: m.ConfigPanel })),
);
const Builder = lazy(() =>
  import("./pages/Builder").then((m) => ({ default: m.Builder })),
);
const Catalog = lazy(() =>
  import("./pages/Catalog").then((m) => ({ default: m.Catalog })),
);
const Ranking = lazy(() =>
  import("./pages/Ranking").then((m) => ({ default: m.Ranking })),
);
const Matrix = lazy(() =>
  import("./pages/Matrix").then((m) => ({ default: m.Matrix })),
);
const MarketMap = lazy(() =>
  import("./pages/MarketMap").then((m) => ({ default: m.MarketMap })),
);
const Uncertainty = lazy(() =>
  import("./pages/Uncertainty").then((m) => ({ default: m.Uncertainty })),
);
const Backtest = lazy(() =>
  import("./pages/Backtest").then((m) => ({ default: m.Backtest })),
);
const TimeExplorer = lazy(() =>
  import("./pages/TimeExplorer").then((m) => ({ default: m.TimeExplorer })),
);
const CiteExport = lazy(() =>
  import("./pages/CiteExport").then((m) => ({ default: m.CiteExport })),
);
const Byod = lazy(() => import("./pages/Byod").then((m) => ({ default: m.Byod })));
const Docs = lazy(() => import("./pages/Docs").then((m) => ({ default: m.Docs })));

function RouteFallback() {
  const { t } = useTranslation();
  return (
    <p className="muted" data-testid="route-loading">
      {t("loading")}
    </p>
  );
}

function AppShell() {
  const { config } = useAnalysis();
  const showConfig = isAnalysisView(config.view);

  return (
    <AppShellFrame
      showConfig={showConfig}
      configSlot={
        <Suspense fallback={null}>
          <ConfigPanel />
        </Suspense>
      }
    >
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/matrix" element={<Matrix />} />
          <Route path="/map" element={<MarketMap />} />
          <Route path="/uncertainty" element={<Uncertainty />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/time" element={<TimeExplorer />} />
          <Route path="/cite" element={<CiteExport />} />
          <Route path="/byod" element={<Byod />} />
          <Route path="/docs" element={<Docs />} />
        </Routes>
      </Suspense>
    </AppShellFrame>
  );
}

export function App() {
  return (
    <AnalysisProvider>
      <AppShell />
    </AnalysisProvider>
  );
}
