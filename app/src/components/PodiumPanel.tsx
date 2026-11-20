import { useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { useToast } from "../state/toastContext";
import { useAnalysis } from "../state/useAnalysis";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { inferPodiumWeights } from "../imsfe/inferPodiumWeights";

/** Drag-order markets → inferred factor weights (Variables / Pesos only). */
export function PodiumPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const { setConfig } = useAnalysis();
  const { model } = useRankingModel();
  const factors = useMemo(
    () => (model ? Object.keys(model.weights.factors) : []),
    [model],
  );
  const [order, setOrder] = useState<string[]>([]);

  const seed = useMemo(() => {
    if (!model) return [] as string[];
    return model.ranking.slice(0, 8).map((r) => r.iso3);
  }, [model]);

  const list = order.length ? order : seed;

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    setOrder(next);
  }

  function apply() {
    if (!model || list.length < 2) {
      toast.push(t("podiumNeedMarkets"));
      return;
    }
    const weights = inferPodiumWeights(list, model.factorScores, factors);
    setConfig({ weightScheme: "manual", factorWeights: weights });
    toast.push(t("podiumApplied"));
  }

  if (!model) {
    return (
      <p className="muted small" data-testid="podium-pending">
        {t("podiumPending")}
      </p>
    );
  }

  return (
    <fieldset className="podium" data-testid="podium-panel">
      <legend>{t("podiumTitle")}</legend>
      <p className="muted small">{t("podiumIntro")}</p>
      <ol className="podium-list">
        {list.map((iso, i) => (
          <li key={iso} data-testid={`podium-row-${iso}`}>
            <span className="font-tabular">
              {i + 1}. {iso}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={`up ${iso}`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={`down ${iso}`}
              disabled={i === list.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button type="button" data-testid="podium-apply" onClick={apply}>
        {t("podiumApply")}
      </button>
    </fieldset>
  );
}
