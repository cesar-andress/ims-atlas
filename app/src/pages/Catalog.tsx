import { useEffect, useMemo, useState } from "react";
import { LicenceBadge } from "../components/LicenceBadge";
import { PageShell } from "../components/PageShell";
import { localizeNotes, loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogVariable } from "../data/types";
import { useTranslation } from "../i18n";
import { FACTOR_LABELS } from "../state/criterionWeights";
import { useAnalysis } from "../state/useAnalysis";
import { useAsyncResource } from "../state/useAsyncResource";

type Lang = "en" | "es";

function statusLabel(v: CatalogVariable, t: (k: string) => string): string {
  if (v.status === "verified") return t("statusReviewed");
  return t("statusPendingReview");
}

function audienceLabel(v: CatalogVariable, t: (k: string) => string): string {
  if (v.audience_public) return t("audiencePublic");
  return t("audienceTeamOnly");
}

function varName(v: CatalogVariable, lang: Lang): string {
  if (typeof v.name === "string") return v.name;
  return v.name[lang] ?? v.name.en ?? v.id;
}

function factorLabel(factor: string, lang: Lang): string {
  return FACTOR_LABELS[factor]?.[lang] ?? factor;
}

type YearHorizon = { min: number; max: number };

function yearHorizon(vars: readonly CatalogVariable[]): YearHorizon | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of vars) {
    const s = v.coverage_stats;
    if (s?.year_min != null) min = Math.min(min, s.year_min);
    if (s?.year_max != null) max = Math.max(max, s.year_max);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
  return { min, max };
}

/** Position of a year span inside the global horizon (0..100). */
function yearSpanStyle(
  v: CatalogVariable,
  horizon: YearHorizon,
): { left: string; width: string } | null {
  const y0 = v.coverage_stats?.year_min;
  const y1 = v.coverage_stats?.year_max ?? y0;
  if (y0 == null || y1 == null) return null;
  const span = Math.max(1, horizon.max - horizon.min);
  const left = ((y0 - horizon.min) / span) * 100;
  const width = ((y1 - y0) / span) * 100;
  return {
    left: `${Math.max(0, Math.min(100, left))}%`,
    width: `${Math.max(2, Math.min(100 - left, width))}%`,
  };
}

/** How far data reaches toward the horizon end (0..100). */
function reachPct(v: CatalogVariable, horizon: YearHorizon): number | null {
  const y1 = v.coverage_stats?.year_max;
  if (y1 == null) return null;
  const span = Math.max(1, horizon.max - horizon.min);
  return Math.max(0, Math.min(100, ((y1 - horizon.min) / span) * 100));
}

function coverageSummary(v: CatalogVariable, t: (k: string) => string): string {
  const s = v.coverage_stats;
  if (!s?.n_countries && s?.year_min == null) return t("coverageNone");
  const n = s.n_countries ?? "—";
  const y0 = s.year_min ?? "—";
  const y1 = s.year_max ?? y0;
  if (s.coverage_pct != null && Number.isFinite(s.coverage_pct)) {
    return t("coverageSummary")
      .replace("{n}", String(n))
      .replace("{y0}", String(y0))
      .replace("{y1}", String(y1))
      .replace("{pct}", String(Math.round(s.coverage_pct)));
  }
  return t("coverageSummaryYears")
    .replace("{n}", String(n))
    .replace("{y0}", String(y0))
    .replace("{y1}", String(y1));
}

function YearCoverageBar({
  variable,
  horizon,
  dense,
}: {
  variable: CatalogVariable;
  horizon: YearHorizon | null;
  dense?: boolean;
}) {
  if (!horizon) return null;
  const span = yearSpanStyle(variable, horizon);
  const reach = reachPct(variable, horizon);
  if (!span && reach == null) return null;
  const y0 = variable.coverage_stats?.year_min;
  const y1 = variable.coverage_stats?.year_max;
  const title = y0 != null && y1 != null ? `${y0}–${y1}` : y1 != null ? String(y1) : "";
  return (
    <div
      className={`catalog-year-track${dense ? " catalog-year-track-dense" : ""}`}
      title={title}
      aria-hidden
    >
      {reach != null ? (
        <span className="catalog-year-reach" style={{ width: `${reach}%` }} />
      ) : null}
      {span ? (
        <span
          className="catalog-year-span"
          style={{ left: span.left, width: span.width }}
        />
      ) : null}
    </div>
  );
}

export function Catalog() {
  const { t, i18n } = useTranslation();
  const { config } = useAnalysis();
  const {
    data: catalog,
    error,
    loading,
  } = useAsyncResource(() => loadCatalogPreview(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (catalog && !selectedId) {
      setSelectedId(catalog.variables[0]?.id ?? null);
    }
  }, [catalog, selectedId]);

  const lang: Lang = i18n.language.startsWith("es") ? "es" : "en";
  const horizon = useMemo(
    () => (catalog ? yearHorizon(catalog.variables) : null),
    [catalog],
  );

  const byFactor = useMemo(() => {
    const map = new Map<string, CatalogVariable[]>();
    const q = query.trim().toLowerCase();
    for (const v of catalog?.variables ?? []) {
      if (q) {
        const hay = `${v.id} ${varName(v, lang)} ${v.factor}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const list = map.get(v.factor) ?? [];
      list.push(v);
      map.set(v.factor, list);
    }
    return map;
  }, [catalog, query, lang]);

  const selected = catalog?.variables.find((v) => v.id === selectedId) ?? null;
  const selectedNotes = selected ? localizeNotes(selected.notes, lang) : null;
  const cellPct =
    selected?.coverage_stats?.coverage_pct != null &&
    Number.isFinite(selected.coverage_stats.coverage_pct)
      ? Math.round(selected.coverage_stats.coverage_pct)
      : null;

  return (
    <PageShell
      testId="catalog-view"
      titleKey="nav.catalog"
      intro={t("catalogIntro")}
      className="catalog"
      omitTitleWhenEmbedded
    >
      {config.origin || config.year ? (
        <p className="note" data-testid="catalog-config-echo">
          {t("permalinkState")}: {config.origin ?? "—"} / {config.year ?? "—"}
        </p>
      ) : null}
      {loading ? <p data-testid="catalog-loading">{t("loading")}</p> : null}
      {error ? (
        <p className="error" data-testid="catalog-error">
          {error}
        </p>
      ) : null}
      {catalog ? (
        <div className="catalog-grid">
          <div className="catalog-list">
            <label className="catalog-list-search">
              <span className="visually-hidden">{t("catalogSearchPlaceholder")}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("catalogSearchPlaceholder")}
                data-testid="catalog-search"
              />
            </label>
            {horizon ? (
              <p className="catalog-horizon muted small">
                {t("coverageHorizon")
                  .replace("{y0}", String(horizon.min))
                  .replace("{y1}", String(horizon.max))}
              </p>
            ) : null}
            {[...byFactor.entries()].map(([factor, vars]) => (
              <div key={factor} className="factor-block">
                <h2>{factorLabel(factor, lang)}</h2>
                <ul>
                  {vars.map((v) => {
                    const name = varName(v, lang);
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          className={v.id === selectedId ? "active" : ""}
                          onClick={() => setSelectedId(v.id)}
                          data-testid={`catalog-var-${v.id}`}
                        >
                          <span className="var-id">{v.id}</span>
                          <span className="var-name">{name}</span>
                          <YearCoverageBar variable={v} horizon={horizon} dense />
                        </button>
                        <span className="badge-row">
                          {v.licence_ids.map((lic) => (
                            <LicenceBadge key={`${v.id}-${lic}`} licenceId={lic} />
                          ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {byFactor.size === 0 ? (
              <p className="muted">{t("catalogSearchEmpty")}</p>
            ) : null}
          </div>
          <div className="catalog-detail results-card">
            {selected ? (
              <>
                <header className="catalog-detail-head">
                  <p className="catalog-detail-factor muted small">
                    {factorLabel(selected.factor, lang)}
                  </p>
                  <h2 data-testid="catalog-detail-id">{selected.id}</h2>
                  <p className="catalog-detail-name">{varName(selected, lang)}</p>
                  <p className="muted" data-testid="catalog-detail-status">
                    {statusLabel(selected, t)} · {audienceLabel(selected, t)}
                  </p>
                </header>
                <div className="badge-row" data-testid="catalog-detail-licences">
                  {selected.licence_ids.length ? (
                    selected.licence_ids.map((lic) => (
                      <LicenceBadge key={lic} licenceId={lic} />
                    ))
                  ) : (
                    <span className="muted">{t("coverageNone")}</span>
                  )}
                </div>
                {selected.citation ? (
                  <p className="citation">{selected.citation}</p>
                ) : null}
                {selectedNotes ? (
                  <p
                    className="catalog-detail-notes"
                    data-testid="catalog-detail-notes"
                  >
                    {selectedNotes}
                  </p>
                ) : null}
                <section
                  className="catalog-coverage"
                  aria-labelledby="catalog-coverage-title"
                >
                  <h3 id="catalog-coverage-title">{t("coverage")}</h3>
                  <p data-testid="catalog-detail-coverage">
                    {coverageSummary(selected, t)}
                  </p>
                  <YearCoverageBar variable={selected} horizon={horizon} />
                  {horizon ? (
                    <div className="catalog-year-axis muted small">
                      <span>{horizon.min}</span>
                      <span>{horizon.max}</span>
                    </div>
                  ) : null}
                  {cellPct != null ? (
                    <div className="catalog-cell-coverage">
                      <div className="coverage-bar" title={`${cellPct}%`}>
                        <span style={{ width: `${cellPct}%` }} />
                      </div>
                      <p className="muted small">
                        {t("coverageCellsPct").replace("{pct}", String(cellPct))}
                      </p>
                    </div>
                  ) : null}
                </section>
              </>
            ) : (
              <p className="muted">{t("selectVariable")}</p>
            )}
          </div>
        </div>
      ) : null}
      {catalog?.note ? <p className="muted">{catalog.note}</p> : null}
    </PageShell>
  );
}
