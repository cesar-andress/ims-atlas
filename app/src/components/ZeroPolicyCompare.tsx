import { useMemo } from "react";
import {
  countRankChanges,
  scaleCostWithPolicy,
  type ZeroPolicy,
} from "@ims-atlas/core";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";

function scoresFromScaled(
  candidates: string[],
  scaled: number[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < candidates.length; i++) {
    const v = scaled[i]!;
    if (Number.isFinite(v)) out[candidates[i]!] = v;
  }
  return out;
}

/** Side-by-side rank-change count under alternate cost zero policies (A3). */
export function ZeroPolicyCompare() {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const { model } = useRankingModel();

  const report = useMemo(() => {
    if (!model) return null;
    const costIdx = model.panel.variables.findIndex((v) => v.direction === "cost");
    if (costIdx < 0) return null;
    const series = model.panel.candidates.map(
      (_, i) => model.panel.values[i]?.[costIdx] ?? null,
    );
    const policies: { id: string; policy: ZeroPolicy }[] = [
      {
        id: "epsilon",
        policy: { kind: "epsilon", epsilon: config.zeroEpsilon ?? 0.1 },
      },
      { id: "minmax", policy: { kind: "minmax" } },
      { id: "rank", policy: { kind: "rank" } },
      {
        id: "offset_ratio",
        policy: { kind: "offset_ratio", c: config.zeroOffsetC ?? 0.001 },
      },
    ];
    const baseline = scoresFromScaled(
      model.panel.candidates,
      scaleCostWithPolicy(series, policies[0]!.policy, 10),
    );
    return policies.slice(1).map(({ id, policy }) => {
      const alt = scoresFromScaled(
        model.panel.candidates,
        scaleCostWithPolicy(series, policy, 10),
      );
      return { id, changes: countRankChanges(baseline, alt) };
    });
  }, [model, config.zeroEpsilon, config.zeroOffsetC]);

  if (!report) {
    return (
      <p className="muted small" data-testid="zero-policy-compare-empty">
        {t("zeroPolicyCompareEmpty")}
      </p>
    );
  }

  return (
    <div className="zero-policy-compare" data-testid="zero-policy-compare">
      <p className="muted small">{t("zeroPolicyCompareIntro")}</p>
      <ul className="muted small">
        {report.map((row) => (
          <li key={row.id}>
            ε → {row.id}: {row.changes} {t("zeroPolicyCompareChanges")}
          </li>
        ))}
      </ul>
    </div>
  );
}
