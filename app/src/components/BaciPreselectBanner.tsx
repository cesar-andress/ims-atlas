import { useState } from "react";
import { loadBaciTopImporters } from "../data/baciTopImporters";
import { getBaciImportCache } from "../data/baciImportCache";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

/**
 * BACI trade volumes need DuckDB-WASM (~MB download + init). Do not auto-start
 * that on every ConfigPanel mount — ranking already falls back to the demo
 * panel import proxy until the user opts in.
 */
export function BaciPreselectBanner() {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const cached = getBaciImportCache();
  const hs = config.hs;
  const year = config.year;
  const cacheHit =
    cached?.source === "baci_release" &&
    hs &&
    year !== undefined &&
    cached.hs2 === hs.replace(/\D/g, "").padStart(2, "0").slice(0, 2) &&
    cached.year === year;

  const [state, setState] = useState<"idle" | "loading" | "baci" | "fixture">(
    cacheHit ? "baci" : "idle",
  );
  const [topN, setTopN] = useState(cacheHit ? Object.keys(cached!.volumes).length : 0);

  async function onLoad() {
    if (!hs || year === undefined) {
      setState("fixture");
      return;
    }
    setState("loading");
    const r = await loadBaciTopImporters({
      hs,
      year,
      topN: config.preselectTopN ?? 30,
    });
    if (r.source === "baci_release" && r.top.length > 0) {
      setTopN(r.top.length);
      setState("baci");
    } else {
      setState("fixture");
    }
  }

  if (state === "loading") {
    return (
      <p className="muted small" data-testid="baci-preselect-loading">
        {t("baciPreselectLoading")}
      </p>
    );
  }
  if (state === "baci") {
    return (
      <p className="muted small" role="status" data-testid="baci-preselect-ok">
        {t("baciPreselectOk")} ({topN})
      </p>
    );
  }
  if (state === "fixture") {
    return (
      <p className="access-toast" role="status" data-testid="baci-preselect-fixture">
        {t("baciPreselectFixture")}
      </p>
    );
  }
  return (
    <p className="muted small" data-testid="baci-preselect-idle">
      <button
        type="button"
        className="btn ghost"
        data-testid="baci-preselect-load"
        onClick={() => void onLoad()}
      >
        {t("baciPreselectLoad")}
      </button>
    </p>
  );
}
