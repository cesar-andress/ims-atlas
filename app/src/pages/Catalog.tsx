import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { LicenceBadge } from "../components/LicenceBadge";
import { PageShell } from "../components/PageShell";
import { loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogVariable } from "../data/types";
import { useAnalysis } from "../state/useAnalysis";
import { useAsyncResource } from "../state/useAsyncResource";

function statusLabel(v: CatalogVariable, t: (k: string) => string): string {
  if (v.status === "verified") return t("statusReviewed");
  return t("statusPendingReview");
}

function audienceLabel(v: CatalogVariable, t: (k: string) => string): string {
  if (v.audience_public) return t("audiencePublic");
  return t("audienceTeamOnly");
}

function coverageLine(v: CatalogVariable, t: (k: string) => string): string {
  const s = v.coverage_stats;
  if (!s?.n_countries && s?.year_min == null) return t("coverageNone");
  const n = s.n_countries ?? "—";
  const y0 = s.year_min ?? "—";
  const y1 = s.year_max ?? y0;
  const pct =
    s.coverage_pct != null && Number.isFinite(s.coverage_pct)
      ? String(Math.round(s.coverage_pct))
      : "—";
  return t("coverageSummary")
    .replace("{n}", String(n))
    .replace("{y0}", String(y0))
    .replace("{y1}", String(y1))
    .replace("{pct}", pct);
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

  useEffect(() => {
    if (catalog && !selectedId) {
      setSelectedId(catalog.variables[0]?.id ?? null);
    }
  }, [catalog, selectedId]);

  const byFactor = useMemo(() => {
    const map = new Map<string, CatalogVariable[]>();
    for (const v of catalog?.variables ?? []) {
      const list = map.get(v.factor) ?? [];
      list.push(v);
      map.set(v.factor, list);
    }
    return map;
  }, [catalog]);

  const selected = catalog?.variables.find((v) => v.id === selectedId) ?? null;
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  return (
    <PageShell
      testId="catalog-view"
      titleKey="nav.catalog"
      intro={t("catalogIntro")}
      className="catalog"
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
            {[...byFactor.entries()].map(([factor, vars]) => (
              <div key={factor} className="factor-block">
                <h2>{factor}</h2>
                <ul>
                  {vars.map((v) => {
                    const name =
                      typeof v.name === "string" ? v.name : (v.name[lang] ?? v.id);
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
          </div>
          <div className="catalog-detail">
            {selected ? (
              <>
                <h2 data-testid="catalog-detail-id">{selected.id}</h2>
                <p>
                  {typeof selected.name === "string"
                    ? selected.name
                    : (selected.name[lang] ?? selected.id)}
                </p>
                <p className="muted" data-testid="catalog-detail-status">
                  {statusLabel(selected, t)} · {audienceLabel(selected, t)}
                </p>
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
                {selected.notes ? (
                  <p className="muted small" data-testid="catalog-detail-notes">
                    {selected.notes}
                  </p>
                ) : null}
                <h3>{t("coverage")}</h3>
                <p data-testid="catalog-detail-coverage">{coverageLine(selected, t)}</p>
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
