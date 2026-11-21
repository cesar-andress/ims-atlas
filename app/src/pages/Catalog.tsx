import { useEffect, useMemo, useState } from "react";
import { LicenceBadge } from "../components/LicenceBadge";
import { PageShell } from "../components/PageShell";
import {
  computeYearGaps,
  formatYearRanges,
  searchCountries,
} from "../data/countryYearGaps";
import { localizeNotes, loadCatalogPreview } from "../data/catalogLoader";
import { countryLabel } from "../design/formatLocale";
import { loadVariableCountryYears } from "../data/loadVariableCountryYears";
import { collectVariableSourceUrls, type SourceUrlKind } from "../data/sourceUrls";
import { loadSources, type TransparencySource } from "../data/transparency";
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
  const n = s.n_countries ?? "-";
  const y0 = s.year_min ?? "-";
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

function sourceLinkLabel(kind: SourceUrlKind, t: (k: string) => string): string {
  if (kind === "landing") return t("catalogSourceLanding");
  if (kind === "terms") return t("catalogSourceTerms");
  if (kind === "licence") return t("catalogSourceLicence");
  return t("catalogSourceDownload");
}

export function Catalog() {
  const { t, i18n } = useTranslation();
  const { config } = useAnalysis();
  const {
    data: catalog,
    error,
    loading,
  } = useAsyncResource(() => loadCatalogPreview(), []);
  const { data: sourcesPayload } = useAsyncResource(() => loadSources(), []);
  const [selectedId, setSelectedId] = useState<string | null>(
    config.focusVariable ?? null,
  );
  const [query, setQuery] = useState("");
  const [countryQuery, setCountryQuery] = useState(config.origin ?? "");
  const [selectedIso3, setSelectedIso3] = useState<string | null>(
    config.origin && /^[A-Za-z]{3}$/.test(config.origin)
      ? config.origin.toUpperCase()
      : null,
  );
  const [yearsState, setYearsState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; years: number[] }
    | {
        status: "unavailable";
        reason: "needs_hs" | "bilateral" | "not_in_release" | "error";
        detail?: string;
      }
  >({ status: "idle" });

  useEffect(() => {
    if (config.focusVariable) {
      setSelectedId(config.focusVariable);
    }
  }, [config.focusVariable]);

  useEffect(() => {
    if (config.origin && /^[A-Za-z]{3}$/.test(config.origin)) {
      const iso = config.origin.toUpperCase();
      setSelectedIso3(iso);
      setCountryQuery(iso);
    }
  }, [config.origin]);

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

  const sourcesById = useMemo(() => {
    const map = new Map<string, TransparencySource>();
    for (const s of sourcesPayload?.sources ?? []) {
      if (s.id) map.set(s.id, s);
    }
    return map;
  }, [sourcesPayload]);

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

  const sourceUrlRows = useMemo(() => {
    if (!selected) return [];
    return collectVariableSourceUrls(selected.source_ids, sourcesById);
  }, [selected, sourcesById]);

  const countryHits = useMemo(
    () => searchCountries(countryQuery, lang),
    [countryQuery, lang],
  );

  useEffect(() => {
    if (!selected || !selectedIso3) {
      setYearsState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setYearsState({ status: "loading" });
    void loadVariableCountryYears({
      variableId: selected.id,
      iso3: selectedIso3,
      hs: config.hs ?? null,
    }).then((result) => {
      if (cancelled) return;
      if (result.status === "ok") {
        setYearsState({ status: "ready", years: result.years });
      } else {
        setYearsState({
          status: "unavailable",
          reason: result.reason,
          ...(result.detail ? { detail: result.detail } : {}),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected, selectedIso3, config.hs]);

  const yearReport =
    yearsState.status === "ready" && horizon
      ? computeYearGaps(yearsState.years, horizon)
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
          {t("permalinkState")}: {config.origin ?? "-"} / {config.year ?? "-"}
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

                <section
                  className="catalog-source-links"
                  aria-labelledby="catalog-source-links-title"
                  data-testid="catalog-source-links"
                >
                  <h3 id="catalog-source-links-title">{t("catalogSourceLinks")}</h3>
                  {sourceUrlRows.length === 0 ? (
                    <p className="muted small">{t("catalogSourceNoUrls")}</p>
                  ) : (
                    sourceUrlRows.map((row) => (
                      <div
                        key={row.sourceId}
                        className="catalog-source-block"
                        data-testid={`catalog-source-${row.sourceId}`}
                      >
                        <p className="catalog-source-id muted">{row.sourceId}</p>
                        {row.links.length === 0 ? (
                          <p className="muted small">{t("catalogSourceNoUrls")}</p>
                        ) : (
                          <ul className="catalog-source-link-list">
                            {row.links.map((link) => (
                              <li key={`${link.kind}-${link.url}`}>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  data-testid={`catalog-source-url-${link.kind}`}
                                >
                                  {sourceLinkLabel(link.kind, t)}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  )}
                </section>

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

                <section
                  className="catalog-country-years"
                  aria-labelledby="catalog-country-years-title"
                  data-testid="catalog-country-years"
                >
                  <h3 id="catalog-country-years-title">
                    {t("catalogCountryYearsTitle")}
                  </h3>
                  <label className="catalog-country-search">
                    <span className="small">{t("catalogCountrySearch")}</span>
                    <input
                      type="search"
                      value={countryQuery}
                      onChange={(e) => {
                        setCountryQuery(e.target.value);
                      }}
                      placeholder={t("catalogCountrySearchPlaceholder")}
                      data-testid="catalog-country-search"
                    />
                  </label>
                  {countryQuery.trim() ? (
                    countryHits.length > 0 ? (
                      <ul
                        className="catalog-country-hits"
                        data-testid="catalog-country-hits"
                      >
                        {countryHits.map((hit) => (
                          <li key={hit.iso3}>
                            <button
                              type="button"
                              className={
                                selectedIso3 === hit.iso3 ? "active" : undefined
                              }
                              data-testid={`catalog-country-hit-${hit.iso3}`}
                              onClick={() => {
                                setSelectedIso3(hit.iso3);
                                setCountryQuery(`${hit.name} (${hit.iso3})`);
                              }}
                            >
                              {hit.name} <code className="muted">{hit.iso3}</code>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">{t("catalogCountryYearsEmptyHits")}</p>
                    )
                  ) : null}

                  {!selectedIso3 ? (
                    <p className="muted small">{t("catalogCountryYearsPick")}</p>
                  ) : null}

                  {selectedIso3 && yearsState.status === "loading" ? (
                    <p
                      className="muted small"
                      data-testid="catalog-country-years-loading"
                    >
                      {t("catalogCountryYearsLoading")}
                    </p>
                  ) : null}

                  {selectedIso3 && yearsState.status === "unavailable" ? (
                    <p
                      className="muted small"
                      data-testid="catalog-country-years-unavailable"
                    >
                      {yearsState.reason === "needs_hs"
                        ? t("catalogCountryYearsNeedsHs")
                        : yearsState.reason === "bilateral"
                          ? t("catalogCountryYearsBilateral")
                          : yearsState.reason === "error"
                            ? t("catalogCountryYearsError").replace(
                                "{detail}",
                                yearsState.detail ?? "-",
                              )
                            : t("catalogCountryYearsNotInRelease")}
                    </p>
                  ) : null}

                  {selectedIso3 && yearReport ? (
                    <div
                      className="catalog-country-year-report"
                      data-testid="catalog-country-year-report"
                    >
                      <p className="small muted">
                        {countryLabel(selectedIso3, lang)} ({selectedIso3})
                      </p>
                      {yearReport.present.length === 0 ? (
                        <p data-testid="catalog-country-years-none">
                          {t("catalogCountryYearsNonePresent")
                            .replace("{y0}", String(yearReport.window.min))
                            .replace("{y1}", String(yearReport.window.max))}
                        </p>
                      ) : yearReport.missing.length === 0 ? (
                        <p data-testid="catalog-country-years-all">
                          {t("catalogCountryYearsAllPresent")
                            .replace("{y0}", String(yearReport.window.min))
                            .replace("{y1}", String(yearReport.window.max))}
                        </p>
                      ) : (
                        <>
                          <p data-testid="catalog-country-years-present">
                            {t("catalogCountryYearsPresent")
                              .replace("{ranges}", formatYearRanges(yearReport.present))
                              .replace("{n}", String(yearReport.present.length))}
                          </p>
                          <p data-testid="catalog-country-years-missing">
                            {t("catalogCountryYearsMissing")
                              .replace("{y0}", String(yearReport.window.min))
                              .replace("{y1}", String(yearReport.window.max))
                              .replace("{ranges}", formatYearRanges(yearReport.missing))
                              .replace("{n}", String(yearReport.missing.length))}
                          </p>
                        </>
                      )}
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
