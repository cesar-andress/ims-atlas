import { useMemo, useState } from "react";
import {
  aggregateExpertMeans,
  ahpFromPairwise,
  anonymizeExpertLabels,
  IMSFE_2025_FOOTWEAR,
  validateUnitWeights,
  type ExpertResponse,
} from "@ims-atlas/core";
import { useTranslation } from "../i18n";
import { useToast } from "../state/toastContext";
import { useAnalysis } from "../state/useAnalysis";

const CRITERIA = Object.keys(IMSFE_2025_FOOTWEAR.structure);

function blankResponses(n: number): ExpertResponse[] {
  const labels = anonymizeExpertLabels(n);
  const base = IMSFE_2025_FOOTWEAR.criterionWeights;
  return labels.map((label) => ({
    label,
    criteria: { ...base },
    variablesWithin: {},
  }));
}

function saatyOptions(): number[] {
  return [1 / 9, 1 / 7, 1 / 5, 1 / 3, 1, 3, 5, 7, 9];
}

function identityPairwise(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 1)),
  );
}

/** Expert survey + Saaty AHP for IMSFE criteria (Advanced options). */
export function ExpertSurveyPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const { setConfig } = useAnalysis();
  const [responses, setResponses] = useState<ExpertResponse[]>(() => blankResponses(2));
  const [pairwise, setPairwise] = useState<number[][]>(() =>
    identityPairwise(CRITERIA.length),
  );

  const agg = useMemo(() => aggregateExpertMeans(responses), [responses]);
  const ahp = useMemo(() => ahpFromPairwise(pairwise), [pairwise]);

  function setExpertWeight(idx: number, criterion: string, raw: number) {
    setResponses((prev) => {
      const next = prev.map((r, i) =>
        i === idx ? { ...r, criteria: { ...r.criteria, [criterion]: raw } } : r,
      );
      return next;
    });
  }

  function applyMeans() {
    for (const r of responses) {
      const v = validateUnitWeights(r.criteria);
      if (!v.ok) {
        toast.push(
          t("expertSurveySumError")
            .replace("{label}", r.label)
            .replace("{sum}", v.sum.toFixed(3)),
        );
        return;
      }
    }
    setConfig({
      weightScheme: "manual",
      factorWeights: { ...agg.meanCriteria },
      methodFamily: "imsfe_2025",
    });
    toast.push(t("expertSurveyApplied"));
  }

  function applyAhp() {
    if (ahp.cr > 0.1) {
      toast.push(t("ahpCrWarning").replace("{cr}", ahp.cr.toFixed(3)));
    }
    const weights = Object.fromEntries(
      CRITERIA.map((c, i) => [c, ahp.weights[i] ?? 0]),
    );
    setConfig({
      weightScheme: "manual",
      factorWeights: weights,
      methodFamily: "imsfe_2025",
    });
    toast.push(t("ahpWeightsApplied"));
  }

  function setPair(i: number, j: number, value: number) {
    setPairwise((prev) => {
      const next = prev.map((row) => [...row]);
      next[i]![j] = value;
      next[j]![i] = value === 0 ? 0 : 1 / value;
      return next;
    });
  }

  return (
    <fieldset className="expert-survey" data-testid="expert-survey-panel">
      <legend>{t("expertSurveyTitle")}</legend>
      <p className="muted small">{t("expertSurveyIntro")}</p>

      <label>
        {t("expertSurveyCount")}
        <input
          type="number"
          min={1}
          max={20}
          value={responses.length}
          data-testid="expert-survey-count"
          onChange={(e) => {
            const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
            setResponses(blankResponses(n));
            setPairwise(identityPairwise(CRITERIA.length));
          }}
        />
      </label>

      {responses.map((r, idx) => {
        const check = validateUnitWeights(r.criteria);
        return (
          <div key={r.label} className="expert-row" data-testid={`expert-row-${idx}`}>
            <strong>{r.label}</strong>
            <div className="expert-weights">
              {CRITERIA.map((c) => (
                <label key={c}>
                  {c}
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={Number((r.criteria[c] ?? 0).toFixed(4))}
                    onChange={(e) => setExpertWeight(idx, c, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
            <span
              className={check.ok ? "muted small" : "error small"}
              data-testid={`expert-sum-${idx}`}
            >
              Σ = {check.sum.toFixed(3)}
              {check.ok ? "" : ` — ${t("expertSurveyMustSum1")}`}
            </span>
          </div>
        );
      })}

      <div data-testid="expert-survey-stats">
        <p className="muted small">{t("expertSurveyMeans")}</p>
        <ul className="compact">
          {CRITERIA.map((c) => {
            const s = agg.criteria[c];
            if (!s) return null;
            return (
              <li key={c}>
                {c}: mean {(s.mean * 100).toFixed(1)}% · min {(s.min * 100).toFixed(1)}%
                · max {(s.max * 100).toFixed(1)}% · sd {(s.sd * 100).toFixed(1)}
              </li>
            );
          })}
        </ul>
      </div>

      <button type="button" data-testid="expert-survey-apply" onClick={applyMeans}>
        {t("expertSurveyApply")}
      </button>

      <details className="ahp-block" data-testid="ahp-block">
        <summary>{t("ahpTitle")}</summary>
        <p className="muted small">{t("ahpIntro")}</p>
        <table className="ahp-table">
          <thead>
            <tr>
              <th />
              {CRITERIA.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((row, i) => (
              <tr key={row}>
                <th scope="row">{row}</th>
                {CRITERIA.map((col, j) => (
                  <td key={col}>
                    {i === j ? (
                      "1"
                    ) : i < j ? (
                      <select
                        aria-label={`${row} vs ${col}`}
                        value={String(pairwise[i]![j])}
                        onChange={(e) => setPair(i, j, Number(e.target.value))}
                      >
                        {saatyOptions().map((v) => (
                          <option key={v} value={v}>
                            {v < 1 ? `1/${Math.round(1 / v)}` : String(v)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (1 / (pairwise[j]![i] ?? 1)).toFixed(3)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p data-testid="ahp-cr">
          CR = {ahp.cr.toFixed(3)}
          {ahp.cr > 0.1 ? ` — ${t("ahpCrHigh")}` : ""}
          {ahp.mostInconsistent
            ? ` · ${t("ahpMostInconsistent")}: ${CRITERIA[ahp.mostInconsistent.i]} vs ${CRITERIA[ahp.mostInconsistent.j]}`
            : ""}
        </p>
        <button type="button" data-testid="ahp-apply" onClick={applyAhp}>
          {t("ahpApply")}
        </button>
      </details>

      <button
        type="button"
        className="muted"
        data-testid="expert-survey-reset"
        onClick={() => {
          setResponses(blankResponses(2));
          setPairwise(identityPairwise(CRITERIA.length));
          toast.push(t("expertSurveyReset"));
        }}
      >
        {t("expertSurveyReset")}
      </button>
    </fieldset>
  );
}
