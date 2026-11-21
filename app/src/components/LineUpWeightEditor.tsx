import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "../i18n";
import { formatPctLocale } from "../design/formatLocale";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";

const TINTS = [
  "#0072B2",
  "#E69F00",
  "#009E73",
  "#CC79A7",
  "#56B4E9",
  "#D55E00",
  "#0F766E",
];

function normalize(w: Record<string, number>): Record<string, number> {
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const n = Object.keys(w).length || 1;
    return Object.fromEntries(Object.keys(w).map((k) => [k, 1 / n]));
  }
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / sum]));
}

/**
 * LineUp-style weight editor: drag bar widths to change factor weights;
 * preview ranking re-orders with a short CSS transition (Variables / Pesos only).
 */
export function LineUpWeightEditor() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { setConfig } = useAnalysis();
  const { model } = useRankingModel();
  const [draft, setDraft] = useState<Record<string, number>>({});
  const drag = useRef<{ factor: string; startX: number; startW: number } | null>(null);

  const factors = useMemo(
    () => (model ? Object.keys(model.weights.factors).sort() : []),
    [model],
  );

  useEffect(() => {
    if (!model) return;
    setDraft({ ...model.weights.factors });
  }, [model]);

  const preview = useMemo(() => {
    if (!model || Object.keys(draft).length === 0) return [];
    const w = normalize(draft);
    const scored = model.prepared.candidates.map((iso, i) => {
      let s = 0;
      for (const f of factors) {
        s += (w[f] ?? 0) * (model.factorScores[iso]?.[f] ?? 0);
      }
      return {
        iso3: iso,
        score: s,
        prevRank: model.ranking.find((r) => r.iso3 === iso)?.rank ?? i + 1,
      };
    });
    scored.sort((a, b) => {
      const aOk = Number.isFinite(a.score);
      const bOk = Number.isFinite(b.score);
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      if (aOk && bOk) {
        const d = b.score - a.score;
        if (d !== 0) return d;
      }
      return a.iso3.localeCompare(b.iso3);
    });
    return scored.slice(0, 8).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [model, draft, factors]);

  function onPointerDown(factor: string, e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { factor, startX: e.clientX, startW: draft[factor] ?? 0 };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const delta = dx / 280;
    const next = {
      ...draft,
      [drag.current.factor]: Math.max(0.02, drag.current.startW + delta),
    };
    setDraft(normalize(next));
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    setConfig({ weightScheme: "manual", factorWeights: normalize(draft) });
  }

  if (!model || factors.length === 0) {
    return (
      <p className="muted small" data-testid="lineup-weights-pending">
        {t("lineUpPending")}
      </p>
    );
  }

  return (
    <fieldset className="lineup-weights" data-testid="lineup-weight-editor">
      <legend>{t("lineUpTitle")}</legend>
      <p className="muted small">{t("lineUpIntro")}</p>
      <ul className="lineup-weight-list">
        {factors.map((f, i) => (
          <li key={f}>
            <div className="flex justify-between text-sm">
              <span>{f}</span>
              <span className="font-tabular">
                {formatPctLocale(draft[f] ?? 0, lang)}
              </span>
            </div>
            <div
              className="lineup-weight-track"
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((draft[f] ?? 0) * 100)}
              aria-label={f}
              data-testid={`lineup-drag-${f}`}
              onPointerDown={(e) => onPointerDown(f, e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onKeyDown={(e) => {
                const step =
                  e.key === "ArrowRight" || e.key === "ArrowUp"
                    ? 0.02
                    : e.key === "ArrowLeft" || e.key === "ArrowDown"
                      ? -0.02
                      : 0;
                if (!step) return;
                e.preventDefault();
                const next = normalize({
                  ...draft,
                  [f]: Math.max(0.02, (draft[f] ?? 0) + step),
                });
                setDraft(next);
                setConfig({ weightScheme: "manual", factorWeights: next });
              }}
            >
              <div
                className="lineup-weight-fill"
                style={{
                  width: `${Math.max(4, (draft[f] ?? 0) * 100)}%`,
                  background: TINTS[i % TINTS.length],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <ol className="lineup-preview" data-testid="lineup-rank-preview">
        {preview.map((r) => (
          <li
            key={r.iso3}
            className="lineup-preview-row font-tabular"
            style={{ transition: "transform 180ms ease" }}
          >
            #{r.rank} {r.iso3}
            {r.prevRank !== r.rank ? (
              <span className="muted small">
                {" "}
                ({r.prevRank > r.rank ? "↑" : "↓"}
                {Math.abs(r.prevRank - r.rank)})
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
