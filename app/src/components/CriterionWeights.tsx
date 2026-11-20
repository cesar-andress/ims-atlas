import { useEffect, useRef, useState } from "react";
import { CRITERION_COLOR, CRITERION_LABEL, isCriterionId } from "../design/criteria";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { FACTOR_LABELS, setOneWeight } from "../state/criterionWeights";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady } from "../state/views";

function labelFor(id: string, lang: "en" | "es"): string {
  if (isCriterionId(id)) return CRITERION_LABEL[id][lang];
  return FACTOR_LABELS[id]?.[lang] ?? id;
}

const SCHEME_KEY: Record<string, string> = {
  expert_mean: "stepWeightsExpert",
  equal: "stepWeightsEqual",
  manual: "stepWeightsOwn",
  entropy: "stepWeightsComputed",
  critic: "stepWeightsComputed",
};

function colorFor(id: string): string {
  return isCriterionId(id) ? CRITERION_COLOR[id] : "var(--primary)";
}

/** Step 2 core: one card per criterion with a weight slider (shares always sum to 100%). */
export function CriterionWeights() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const { model, error, loading } = useRankingModel();
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // A committed config change (or a reset) supersedes any in-flight drag.
  useEffect(() => {
    setDraft(null);
  }, [config.factorWeights, config.weightScheme, config.methodFamily]);

  if (!isAnalysisReady(config)) {
    return (
      <p className="callout" data-testid="criteria-needs-scope">
        {t("varsNeedScope")}
      </p>
    );
  }
  if (error && !model) {
    return (
      <p className="error" role="alert" data-testid="criteria-error">
        {error.message}
      </p>
    );
  }
  if (!model) {
    return loading ? <p className="muted">{t("loading")}</p> : null;
  }

  const base = model.weights.factors;
  const shown = draft ?? base;
  const ids = Object.keys(base);
  const isManual = config.weightScheme === "manual";

  function commit() {
    const next = draftRef.current;
    if (!next) return;
    setDraft(null);
    setConfig({ weightScheme: "manual", factorWeights: next });
  }

  return (
    <div data-testid="criterion-weights">
      <div className="crit-grid">
        {ids.map((id) => {
          const pct = Math.round((shown[id] ?? 0) * 100);
          const nVars = Object.keys(model.weights.variablesWithin[id] ?? {}).length;
          return (
            <article
              key={id}
              className="card crit"
              data-testid={`criterion-card-${id}`}
              style={{ borderTopColor: colorFor(id) }}
            >
              <header className="crit-head">
                <h3>{labelFor(id, lang)}</h3>
                <b className="font-tabular" data-testid={`criterion-pct-${id}`}>
                  {pct}%
                </b>
              </header>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pct}
                aria-label={`${t("varsWeightOf")} ${labelFor(id, lang)}`}
                data-testid={`criterion-slider-${id}`}
                onChange={(e) =>
                  setDraft(setOneWeight(shown, id, Number(e.target.value) / 100))
                }
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
              />
              {nVars > 0 ? (
                <small className="muted">
                  {t("varsCount").replace("{n}", String(nVars))}
                </small>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="crit-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="weights-reset-experts"
          disabled={!isManual}
          onClick={() =>
            setConfig({ weightScheme: "expert_mean", factorWeights: undefined })
          }
        >
          {t("varsResetExperts")}
        </button>
        <span className="muted small" data-testid="weights-source">
          {t("varsWeightsSource").replace(
            "{source}",
            t(SCHEME_KEY[config.weightScheme ?? "expert_mean"] ?? "stepWeightsExpert"),
          )}
        </span>
      </p>
    </div>
  );
}
