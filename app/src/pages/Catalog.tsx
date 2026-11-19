import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { CoverageHeatmap } from "../components/CoverageHeatmap";
import { LicenceBadge } from "../components/LicenceBadge";
import { PageShell } from "../components/PageShell";
import { loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogPreview, CatalogVariable } from "../data/types";
import { useAnalysis } from "../state/useAnalysis";

export function Catalog() {
  const { t, i18n } = useTranslation();
  const { config } = useAnalysis();
  const [catalog, setCatalog] = useState<CatalogPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadCatalogPreview()
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        setSelectedId(data.variables[0]?.id ?? null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
                <h2>{selected.id}</h2>
                <p>
                  {typeof selected.name === "string"
                    ? selected.name
                    : (selected.name[lang] ?? selected.id)}
                </p>
                <p className="muted">
                  {t("status")}: {selected.status ?? "—"} · redistributable:{" "}
                  {String(selected.redistributable)}
                </p>
                <div className="badge-row">
                  {selected.licence_ids.map((lic) => (
                    <LicenceBadge key={lic} licenceId={lic} />
                  ))}
                </div>
                {selected.citation ? (
                  <p className="citation">{selected.citation}</p>
                ) : null}
                <h3>{t("coverage")}</h3>
                <CoverageHeatmap variable={selected} />
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
