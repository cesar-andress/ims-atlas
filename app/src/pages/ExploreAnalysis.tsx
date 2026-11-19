import { useEffect, useMemo, useState } from "react";
import {
  correlationMatrix,
  highCorrelationWarnings,
  spearmanCorr,
} from "@ims-atlas/core";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogVariable } from "../data/types";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

function seriesForVar(
  v: CatalogVariable | undefined,
  year: number,
): { iso3: string; value: number }[] {
  if (!v?.coverage_demo) return [];
  const out: { iso3: string; value: number }[] = [];
  for (const [iso3, byYear] of Object.entries(v.coverage_demo)) {
    const val = byYear[String(year)];
    if (val !== null && val !== undefined && Number.isFinite(val)) {
      out.push({ iso3, value: val });
    }
  }
  return out;
}

/** Phase E analysis: correlation matrix + scatter. */
export function ExploreAnalysis() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const [vars, setVars] = useState<CatalogVariable[]>([]);
  const year = config.year ?? 2023;
  const basket = config.variableIds?.length
    ? config.variableIds
    : vars.slice(0, 8).map((v) => v.id);

  const xId = config.scatterX ?? basket[0] ?? "";
  const yId = config.scatterY ?? basket[1] ?? basket[0] ?? "";

  useEffect(() => {
    void loadCatalogPreview().then((c) => setVars(c.variables));
  }, []);

  const selected = useMemo(
    () => vars.filter((v) => basket.includes(v.id)),
    [vars, basket],
  );

  const corr = useMemo(() => {
    const cols = selected.map((v) => v.id);
    const isoList = Object.keys(selected[0]?.coverage_demo ?? {}).sort();
    const seriesAligned = selected.map((v) =>
      isoList.map((iso) => {
        const val = v.coverage_demo?.[iso]?.[String(year)];
        return val !== null && val !== undefined && Number.isFinite(val)
          ? (val as number)
          : null;
      }),
    );
    const mat = correlationMatrix(cols, seriesAligned);
    return { cols, mat, warns: highCorrelationWarnings(cols, mat, 0.8) };
  }, [selected, year]);

  const scatter = useMemo(() => {
    const vx = vars.find((v) => v.id === xId);
    const vy = vars.find((v) => v.id === yId);
    const xs = seriesForVar(vx, year);
    const ys = seriesForVar(vy, year);
    const mapY = new Map(ys.map((p) => [p.iso3, p.value]));
    const points = xs
      .map((p) => {
        const y = mapY.get(p.iso3);
        if (y === undefined) return null;
        return { iso3: p.iso3, x: p.value, y };
      })
      .filter((p): p is { iso3: string; x: number; y: number } => p !== null);
    const recX: Record<string, number> = {};
    const recY: Record<string, number> = {};
    for (const p of points) {
      recX[p.iso3] = p.x;
      recY[p.iso3] = p.y;
    }
    const rho = points.length >= 3 ? spearmanCorr(recX, recY) : Number.NaN;
    // simple trend: least squares
    let slope = 0;
    let intercept = 0;
    if (points.length >= 2) {
      const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const my = points.reduce((s, p) => s + p.y, 0) / points.length;
      let num = 0;
      let den = 0;
      for (const p of points) {
        num += (p.x - mx) * (p.y - my);
        den += (p.x - mx) ** 2;
      }
      slope = den === 0 ? 0 : num / den;
      intercept = my - slope * mx;
    }
    return { points, rho, slope, intercept };
  }, [vars, xId, yId, year]);

  const maxX = Math.max(...scatter.points.map((p) => p.x), 1);
  const maxY = Math.max(...scatter.points.map((p) => p.y), 1);

  return (
    <PageShell
      testId="explore-analysis-view"
      titleKey="nav.explore_analysis"
      className="explore-analysis"
    >
      <p className="muted">{t("exploreAnalysisIntro")}</p>

      <section data-testid="explore-corr">
        <h2>{t("exploreCorrTitle")}</h2>
        {corr.cols.length < 2 ? (
          <p className="muted">{t("exploreCorrNeed")}</p>
        ) : (
          <div className="corr-scroll">
            <table data-testid="explore-corr-table">
              <thead>
                <tr>
                  <th />
                  {corr.cols.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corr.cols.map((row, i) => (
                  <tr key={row}>
                    <th>{row}</th>
                    {corr.cols.map((col, j) => {
                      const v = corr.mat[i]?.[j];
                      return (
                        <td key={col}>
                          {typeof v === "number" && Number.isFinite(v)
                            ? v.toFixed(2)
                            : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {corr.warns.length > 0 ? (
          <ul data-testid="explore-corr-warns">
            {corr.warns.map((w) => (
              <li key={`${w.a}-${w.b}`}>{w.messageEn}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section data-testid="explore-scatter">
        <h2>{t("exploreScatterTitle")}</h2>
        <div className="explore-filters">
          <label>
            X{" "}
            <select
              data-testid="scatter-x"
              value={xId}
              onChange={(e) => setConfig({ scatterX: e.target.value })}
            >
              {vars.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Y{" "}
            <select
              data-testid="scatter-y"
              value={yId}
              onChange={(e) => setConfig({ scatterY: e.target.value })}
            >
              {vars.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="small" data-testid="scatter-rho">
          Spearman = {Number.isFinite(scatter.rho) ? scatter.rho.toFixed(3) : "—"} · n=
          {scatter.points.length}
        </p>
        <svg
          viewBox="0 0 320 240"
          className="scatter-svg"
          data-testid="scatter-svg"
          role="img"
          aria-label={`${xId} vs ${yId}`}
        >
          <line
            x1="40"
            y1="200"
            x2="300"
            y2="200"
            stroke="currentColor"
            strokeWidth="1"
          />
          <line
            x1="40"
            y1="200"
            x2="40"
            y2="20"
            stroke="currentColor"
            strokeWidth="1"
          />
          {scatter.points.map((p) => (
            <circle
              key={p.iso3}
              cx={40 + (p.x / maxX) * 250}
              cy={200 - (p.y / maxY) * 170}
              r={3}
            >
              <title>{`${p.iso3}: ${p.x}, ${p.y}`}</title>
            </circle>
          ))}
          {scatter.points.length >= 2 ? (
            <line
              x1={40}
              y1={200 - ((scatter.intercept + scatter.slope * 0) / maxY) * 170}
              x2={290}
              y2={200 - ((scatter.intercept + scatter.slope * maxX) / maxY) * 170}
              stroke="var(--accent, #3a6ea5)"
              strokeWidth="1.5"
            />
          ) : null}
        </svg>
        {scatter.points.slice(0, 12).map((p) => (
          <span key={p.iso3} className="scatter-label small muted">
            {p.iso3}{" "}
          </span>
        ))}
      </section>

      <p>
        <PermalinkLink view="builder">{t("exploreSendBuilder")}</PermalinkLink>
      </p>
    </PageShell>
  );
}
