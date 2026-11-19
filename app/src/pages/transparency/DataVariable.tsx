import { useMemo } from "react";
import { useTranslation } from "../../i18n";
import { TransparencyShell } from "../../components/TransparencyShell";
import { displayCell } from "../../formatDisplay";
import { useAnalysis } from "../../state/useAnalysis";
import { useAsyncResource } from "../../state/useAsyncResource";
import {
  loadSources,
  loadVariables,
  type TransparencyVariable,
} from "../../data/transparency";

function varLabel(v: TransparencyVariable, lang: "en" | "es"): string {
  const name = v.name;
  if (!name) return v.id;
  if (typeof name === "string") return name;
  return name[lang] ?? name.en ?? v.id;
}

function daysAgoLabel(
  iso: string | null | undefined,
  t: (k: string) => string,
): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  return `${iso} (${t("transparencyDaysAgo").replace("{n}", String(days))})`;
}

function nextExpectedFromCadence(
  lastIso: string | null | undefined,
  cadence: string | null | undefined,
): string {
  if (!lastIso || !cadence) return "—";
  const then = Date.parse(lastIso);
  if (Number.isNaN(then)) return "—";
  const c = cadence.toLowerCase();
  let days = 0;
  if (c.includes("annual") || c.includes("year")) days = 365;
  else if (c.includes("biennial")) days = 730;
  else if (c.includes("quarter")) days = 91;
  else if (c.includes("month")) days = 30;
  else return "—";
  return new Date(then + days * 86_400_000).toISOString().slice(0, 10);
}

export function DataVariable() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const { data, error, loading } = useAsyncResource(async () => {
    const [vars, sources] = await Promise.all([loadVariables(), loadSources()]);
    const cadenceBySource = Object.fromEntries(
      sources.sources.map((s) => [s.id, s.update_cadence ?? null]),
    );
    return { rows: vars.variables, cadenceBySource, isFixture: vars.is_fixture };
  }, []);
  const rows = data?.rows;

  const selected = useMemo(() => {
    if (!rows) return null;
    const id = config.focusVariable;
    if (!id) return rows[0] ?? null;
    return rows.find((v) => v.id === id) ?? null;
  }, [rows, config.focusVariable]);

  const selectedCadence = useMemo(() => {
    if (!selected || !data?.cadenceBySource) return null;
    for (const sid of selected.source_ids ?? []) {
      const c = data.cadenceBySource[sid];
      if (c) return c;
    }
    return null;
  }, [selected, data?.cadenceBySource]);

  return (
    <TransparencyShell
      testId="data-variable-view"
      titleKey="nav.data_variable"
      introKey="transparencyVariableIntro"
    >
      {error ? <p className="error">{error}</p> : null}
      {loading || !data || !rows ? (
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
                <dd data-from-json="factor">{displayCell(selected.factor)}</dd>
                <dt>{t("transparencyDirection")}</dt>
                <dd data-from-json="direction">{displayCell(selected.direction)}</dd>
                <dt>{t("transparencyStatus")}</dt>
                <dd data-from-json="status">{displayCell(selected.status)}</dd>
                <dt>{t("transparencyRedistributable")}</dt>
                <dd data-from-json="redistributable">
                  {displayCell(selected.redistributable)}
                </dd>
                <dt>{t("transparencyGate")}</dt>
                <dd data-from-json="gate.decision">
                  {displayCell(selected.gate?.decision)}
                </dd>
                <dt>{t("transparencyIncluded")}</dt>
                <dd data-from-json="gate.included">
                  {displayCell(selected.gate?.included)}
                </dd>
                <dt>{t("transparencyCitation")}</dt>
                <dd data-from-json="citation">{displayCell(selected.citation)}</dd>
                <dt>{t("transparencyDownload")}</dt>
                <dd data-from-json="download_allowed">
                  {displayCell(selected.download_allowed)}
                </dd>
                <dt>{t("transparencyVarUpdated")}</dt>
                <dd data-from-json="last_upstream_change">
                  {daysAgoLabel(
                    selected.last_upstream_change ?? selected.last_checked,
                    t,
                  )}
                </dd>
                <dt>{t("transparencyVarNextExpected")}</dt>
                <dd data-from-json="next_expected">
                  {nextExpectedFromCadence(
                    selected.last_upstream_change ?? selected.last_checked,
                    selectedCadence,
                  )}
                </dd>
                <dt>{t("transparencyVarNewCells")}</dt>
                <dd data-from-json="new_cells_since_previous">
                  {displayCell(selected.new_cells_since_previous)}
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
    </TransparencyShell>
  );
}
