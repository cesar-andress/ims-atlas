import { CRITERIA_TREE_PRESETS, type CriteriaTree } from "@ims-atlas/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { CRITERION_COLOR, CRITERION_LABEL, isCriterionId } from "../design/criteria";
import { useTranslation } from "../i18n";
import { localizeWarning } from "../ranking/localizeWarning";
import { useRankingModel } from "../ranking/useRankingModelApi";
import {
  displayWeightPercents,
  FACTOR_LABELS,
  setOneWeight,
} from "../state/criterionWeights";
import { equalFactorWeights, requestOpenScope } from "../state/projectScope";
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

function treeForFamily(family: string | undefined): CriteriaTree | null {
  if (family === "imsfe_2025") return CRITERIA_TREE_PRESETS.imsfe_2025_footwear;
  if (family === "imsfem_2025_olive") return CRITERIA_TREE_PRESETS.imsfem_2025_olive;
  return null;
}

/** Preview weights when origin/year are missing (editable; ranking still gated). */
function previewFactors(
  methodFamily: string | undefined,
  factorWeights: Record<string, number> | undefined,
  variableIds: string[] | undefined,
): { factors: Record<string, number>; varCount: Record<string, number> } | null {
  const tree = treeForFamily(methodFamily);
  if (tree) {
    const factors =
      factorWeights && Object.keys(factorWeights).length > 0
        ? { ...factorWeights }
        : { ...tree.criterionWeights };
    const varCount = Object.fromEntries(
      Object.entries(tree.structure).map(([k, vars]) => [k, vars.length]),
    );
    return { factors, varCount };
  }
  if (methodFamily === "panel_all") {
    const keys =
      factorWeights && Object.keys(factorWeights).length > 0
        ? Object.keys(factorWeights)
        : ["panel"];
    const factors =
      factorWeights && Object.keys(factorWeights).length > 0
        ? { ...factorWeights }
        : equalFactorWeights(keys);
    const n = variableIds?.length ?? 0;
    const varCount =
      keys.length === 1
        ? { [keys[0]!]: n }
        : Object.fromEntries(
            keys.map((k) => [k, Math.max(1, Math.round(n / keys.length))]),
          );
    return { factors, varCount };
  }
  return null;
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

  const ready = isAnalysisReady(config);
  const preview = useMemo(
    () =>
      ready
        ? null
        : previewFactors(config.methodFamily, config.factorWeights, config.variableIds),
    [ready, config.methodFamily, config.factorWeights, config.variableIds],
  );

  if (!ready) {
    return (
      <div data-testid="criteria-needs-scope">
        <p className="callout">{t("varsNeedScope")}</p>
        <p className="crit-actions">
          <button
            type="button"
            className="btn btn-primary"
            data-testid="criteria-open-scope"
            onClick={() => requestOpenScope()}
          >
            {t("scopeDialogTitle")}
          </button>
        </p>
        {preview ? (
          <WeightCards
            base={preview.factors}
            varCount={preview.varCount}
            draft={draft}
            setDraft={setDraft}
            draftRef={draftRef}
            isManual={config.weightScheme === "manual"}
            schemeKey={config.weightScheme ?? "equal"}
            lang={lang}
            t={t}
            onCommit={(next) =>
              setConfig({ weightScheme: "manual", factorWeights: next })
            }
            onReset={() =>
              setConfig({
                weightScheme:
                  config.methodFamily === "imsfe_2025" ||
                  config.methodFamily === "imsfem_2025_olive"
                    ? "expert_mean"
                    : "equal",
                factorWeights: undefined,
              })
            }
            preview
          />
        ) : (
          <p className="muted small" data-testid="criteria-pick-family">
            {t("varsPickFamilyFirst")}
          </p>
        )}
      </div>
    );
  }
  if (error && !model) {
    return (
      <p className="error" role="alert" data-testid="criteria-error">
        {localizeWarning(error.message, lang)}
      </p>
    );
  }
  if (!model) {
    return loading ? <p className="muted">{t("loading")}</p> : null;
  }

  const base = model.weights.factors;
  const varCount = Object.fromEntries(
    Object.keys(base).map((id) => [
      id,
      Object.keys(model.weights.variablesWithin[id] ?? {}).length,
    ]),
  );

  return (
    <WeightCards
      base={base}
      varCount={varCount}
      draft={draft}
      setDraft={setDraft}
      draftRef={draftRef}
      isManual={config.weightScheme === "manual"}
      schemeKey={config.weightScheme ?? "expert_mean"}
      lang={lang}
      t={t}
      onCommit={(next) => setConfig({ weightScheme: "manual", factorWeights: next })}
      onReset={() =>
        setConfig({ weightScheme: "expert_mean", factorWeights: undefined })
      }
    />
  );
}

type CardsProps = {
  base: Record<string, number>;
  varCount: Record<string, number>;
  draft: Record<string, number> | null;
  setDraft: (w: Record<string, number> | null) => void;
  draftRef: { current: Record<string, number> | null };
  isManual: boolean;
  schemeKey: string;
  lang: "en" | "es";
  t: (k: string) => string;
  onCommit: (next: Record<string, number>) => void;
  onReset: () => void;
  preview?: boolean;
};

function WeightCards({
  base,
  varCount,
  draft,
  setDraft,
  draftRef,
  isManual,
  schemeKey,
  lang,
  t,
  onCommit,
  onReset,
  preview = false,
}: CardsProps) {
  const shown = draft ?? base;
  const ids = Object.keys(base).filter((id) => (varCount[id] ?? 0) > 0);
  const pctMap = displayWeightPercents(shown, varCount);

  function commit() {
    const next = draftRef.current;
    if (!next) return;
    setDraft(null);
    onCommit(next);
  }

  return (
    <div data-testid={preview ? "criterion-weights-preview" : "criterion-weights"}>
      {preview ? (
        <p className="muted small" data-testid="criteria-preview-note">
          {t("varsWeightsPreviewNote")}
        </p>
      ) : null}
      <div className="crit-grid">
        {ids.map((id) => {
          const pct = pctMap[id] ?? 0;
          const nVars = varCount[id] ?? 0;
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
          onClick={onReset}
        >
          {t("varsResetExperts")}
        </button>
        <span className="muted small" data-testid="weights-source">
          {t("varsWeightsSource").replace(
            "{source}",
            t(SCHEME_KEY[schemeKey] ?? "stepWeightsExpert"),
          )}
        </span>
      </p>
    </div>
  );
}
