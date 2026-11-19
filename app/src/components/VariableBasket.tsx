import { useEffect, useMemo, useState } from "react";
import { loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogVariable } from "../data/types";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { PermalinkLink } from "./PermalinkLink";

function label(v: CatalogVariable, lang: "en" | "es"): string {
  if (typeof v.name === "string") return v.name;
  return lang === "es" ? v.name.es : v.name.en;
}

/** "Mis variables" basket bound to config.variableIds (URL). */
export function VariableBasket({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const [catalog, setCatalog] = useState<CatalogVariable[]>([]);

  useEffect(() => {
    void loadCatalogPreview().then((c) => setCatalog(c.variables));
  }, []);

  const ids = useMemo(() => config.variableIds ?? [], [config.variableIds]);
  const chosen = useMemo(
    () => catalog.filter((v) => ids.includes(v.id)),
    [catalog, ids],
  );

  const threshold = config.missingThreshold ?? 0.2;

  function remove(id: string) {
    setConfig({ variableIds: ids.filter((x) => x !== id) });
  }

  function clear() {
    setConfig({ variableIds: [] });
  }

  if (compact && ids.length === 0) {
    return (
      <p className="muted small" data-testid="basket-empty-compact">
        {t("basketEmpty")}{" "}
        <PermalinkLink view="explore">{t("nav.explore")}</PermalinkLink>
      </p>
    );
  }

  return (
    <section className="variable-basket" data-testid="variable-basket">
      <header className="basket-header">
        <h2>{t("basketTitle")}</h2>
        <span className="muted small">
          {t("basketCount").replace("{n}", String(ids.length))}
        </span>
        {ids.length > 0 ? (
          <button type="button" data-testid="basket-clear" onClick={clear}>
            {t("basketClear")}
          </button>
        ) : null}
        <PermalinkLink view="builder">{t("basketToBuilder")}</PermalinkLink>
      </header>
      {ids.length === 0 ? (
        <p className="muted">{t("basketEmpty")}</p>
      ) : (
        <ul data-testid="basket-list">
          {chosen.map((v) => {
            const demo = v.coverage_demo;
            let missingShare = 0;
            if (demo) {
              let total = 0;
              let miss = 0;
              for (const byYear of Object.values(demo)) {
                for (const val of Object.values(byYear)) {
                  total += 1;
                  if (val === null || val === undefined) miss += 1;
                }
              }
              missingShare = total ? miss / total : 1;
            }
            const dropWarn = missingShare > threshold;
            return (
              <li key={v.id} data-testid={`basket-item-${v.id}`}>
                <strong>{v.id}</strong>{" "}
                <span className="muted small">{label(v, lang)}</span>
                {dropWarn ? (
                  <span className="warn small" data-testid={`basket-warn-${v.id}`}>
                    {" "}
                    {t("basketDropWarn")}
                  </span>
                ) : null}
                <button type="button" onClick={() => remove(v.id)}>
                  {t("basketRemove")}
                </button>
              </li>
            );
          })}
          {ids
            .filter((id) => !chosen.some((v) => v.id === id))
            .map((id) => (
              <li key={id}>
                <strong>{id}</strong>{" "}
                <span className="muted small">{t("basketUnknown")}</span>
                <button type="button" onClick={() => remove(id)}>
                  {t("basketRemove")}
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
