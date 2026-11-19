import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n";
import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { useAnalysis } from "../../state/useAnalysis";
import { loadVariables, type TransparencyVariable } from "../../data/transparency";

function str(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function varLabel(v: TransparencyVariable, lang: "en" | "es"): string {
  const name = v.name;
  if (!name) return v.id;
  if (typeof name === "string") return name;
  return name[lang] ?? name.en ?? v.id;
}

export function DataVariable() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const [rows, setRows] = useState<TransparencyVariable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadVariables()
      .then((payload) => {
        if (!cancelled) setRows(payload.variables);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => {
    if (!rows) return null;
    const id = config.focusVariable;
    if (!id) return rows[0] ?? null;
    return rows.find((v) => v.id === id) ?? null;
  }, [rows, config.focusVariable]);

  return (
    <PageShell testId="data-variable-view" titleKey="nav.data_variable">
      <p className="muted">{t("transparencyVariableIntro")}</p>
      <nav className="transparency-nav" aria-label={t("transparencyNav")}>
        <PermalinkLink view="status">{t("nav.status")}</PermalinkLink>
        <PermalinkLink view="data_sources">{t("nav.data_sources")}</PermalinkLink>
        <PermalinkLink view="data_pipeline">{t("nav.data_pipeline")}</PermalinkLink>
        <PermalinkLink view="data_releases">{t("nav.data_releases")}</PermalinkLink>
      </nav>
      {error ? <p className="error">{error}</p> : null}
      {!rows ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <div className="variable-transparency">
          <label>
            {t("transparencyPickVariable")}{" "}
            <select
              data-testid="variable-picker"
              value={selected?.id ?? ""}
              onChange={(e) =>
                setConfig({
                  view: "data_variable",
                  focusVariable: e.target.value,
                })
              }
            >
              {rows.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id} — {varLabel(v, lang)}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div data-testid="variable-detail" data-variable-id={selected.id}>
              <dl className="status-grid">
                <dt>ID</dt>
                <dd data-from-json="id">{selected.id}</dd>
                <dt>{t("transparencyFactor")}</dt>
                <dd data-from-json="factor">{str(selected.factor)}</dd>
                <dt>{t("transparencyDirection")}</dt>
                <dd data-from-json="direction">{str(selected.direction)}</dd>
                <dt>{t("transparencyStatus")}</dt>
                <dd data-from-json="status">{str(selected.status)}</dd>
                <dt>{t("transparencyRedistributable")}</dt>
                <dd data-from-json="redistributable">
                  {str(selected.redistributable)}
                </dd>
                <dt>{t("transparencyGate")}</dt>
                <dd data-from-json="gate.decision">{str(selected.gate?.decision)}</dd>
                <dt>{t("transparencyIncluded")}</dt>
                <dd data-from-json="gate.included">{str(selected.gate?.included)}</dd>
                <dt>{t("transparencyCitation")}</dt>
                <dd data-from-json="citation">{str(selected.citation)}</dd>
                <dt>{t("transparencyDownload")}</dt>
                <dd data-from-json="download_allowed">
                  {str(selected.download_allowed)}
                </dd>
              </dl>

              <h2>{t("transparencyGateReasons")}</h2>
              <ul data-testid="gate-reasons">
                {(selected.gate?.reasons ?? []).map((r) => (
                  <li key={r} data-from-json="gate.reasons">
                    {r}
                  </li>
                ))}
              </ul>

              <h2>{t("transparencySources")}</h2>
              <ul data-testid="variable-sources">
                {(selected.source_ids ?? []).map((sid) => (
                  <li key={sid} data-from-json="source_ids">
                    {sid}
                  </li>
                ))}
              </ul>

              <h2>{t("coverage")}</h2>
              {selected.coverage ? (
                <div className="table-scroll">
                  <table data-testid="coverage-table">
                    <thead>
                      <tr>
                        <th>ISO3</th>
                        {Object.keys(Object.values(selected.coverage)[0] ?? {}).map(
                          (y) => (
                            <th key={y}>{y}</th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selected.coverage).map(([iso, years]) => (
                        <tr key={iso}>
                          <td data-from-json="coverage.iso3">{iso}</td>
                          {Object.entries(years).map(([y, val]) => (
                            <td key={y} data-from-json="coverage.cell">
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">{t("transparencyNoCoverage")}</p>
              )}
            </div>
          ) : (
            <p className="muted">{t("transparencyNoVariable")}</p>
          )}
        </div>
      )}
    </PageShell>
  );
}
