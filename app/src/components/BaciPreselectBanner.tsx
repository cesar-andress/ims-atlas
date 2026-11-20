import { useEffect, useState } from "react";
import { loadBaciTopImporters } from "../data/baciTopImporters";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

/** Loads BACI trade chapter for current HS/year; shows fixture banner when missing. */
export function BaciPreselectBanner() {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const [state, setState] = useState<"loading" | "baci" | "fixture">("loading");
  const [topN, setTopN] = useState(0);

  useEffect(() => {
    const hs = config.hs;
    const year = config.year;
    if (!hs || year === undefined) {
      setState("fixture");
      return;
    }
    let cancelled = false;
    setState("loading");
    void loadBaciTopImporters({
      hs,
      year,
      topN: config.preselectTopN ?? 30,
    }).then((r) => {
      if (cancelled) return;
      if (r.source === "baci_release" && r.top.length > 0) {
        setTopN(r.top.length);
        setState("baci");
      } else {
        setState("fixture");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [config.hs, config.year, config.preselectTopN]);

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
  return (
    <p className="access-toast" role="status" data-testid="baci-preselect-fixture">
      {t("baciPreselectFixture")}
    </p>
  );
}
