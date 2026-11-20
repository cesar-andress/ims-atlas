import { ExportMenu } from "../../components/ExportMenu";
import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { TransparencyShell } from "../../components/TransparencyShell";
import {
  loadFreshness,
  loadIndex,
  loadLatestRun,
  loadQa,
  loadSourcesState,
  loadSpotCheck,
  loadUpdates,
  type SourcesStatePayload,
  type SourcesStateRow,
} from "../../data/transparency";
import { displayCell } from "../../formatDisplay";
import { useTranslation } from "../../i18n";
import { useAsyncResource } from "../../state/useAsyncResource";

function runTone(status: string | null | undefined): "ok" | "warn" | "bad" {
  const s = (status ?? "").toLowerCase();
  if (s === "ok" || s === "pass" || s === "success") return "ok";
  if (s === "qa_blocked" || s === "warn" || s === "partial") return "warn";
  return "bad";
}

function sourceEmoji(
  row: SourcesStateRow | undefined,
  freshnessStatus?: string,
): string {
  const st = (row?.status || freshnessStatus || "").toLowerCase();
  if (
    st.startsWith("falta") ||
    st.includes("file") ||
    st === "pending_file" ||
    st === "no_connector"
  ) {
    return "⚪";
  }
  if (st === "fail" || st === "error" || (row?.consecutive_failures ?? 0) >= 3) {
    return "🔴";
  }
  if (st === "ok" || st === "al_dia" || st === "fresh") {
    return "🟢";
  }
  return "🟡";
}

export function DataStatus() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { data, error, loading } = useAsyncResource(async () => {
    const [index, qa, freshness, run, spot, updates, sourcesState] = await Promise.all([
      loadIndex(),
      loadQa(),
      loadFreshness(),
      loadLatestRun(),
      loadSpotCheck().catch((): Record<string, unknown> => ({
        status: "missing",
        samples: [],
      })),
      loadUpdates().catch(() => ({ runs: [] as const, n_runs: 0 })),
      loadSourcesState().catch(
        (): SourcesStatePayload => ({ sources: {} }),
      ),
    ]);
    return { index, qa, freshness, run, spot, updates, sourcesState };
  }, []);
  return (
    <TransparencyShell
      testId="data-status-view"
      titleKey="nav.status"
      introKey="transparencyIntro"
    >
      {error ? <p className="error">{error}</p> : null}
      {loading || !data ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <>
          <FixtureStatusBanner
            isFixture={Boolean(
              data.index.is_fixture ??
              (data.freshness as { is_fixture?: boolean }).is_fixture,
            )}
            message={
              data.index.fixture_banner ??
              (data.freshness as { fixture_banner?: string | null }).fixture_banner ??
              null
            }
          />
          <dl className="status-grid" data-testid="status-summary">
            <dt>{t("transparencyRelease")}</dt>
            <dd data-from-json="current_release">{data.index.current_release}</dd>
            <dt>{t("transparencyFreshnessAt")}</dt>
            <dd data-from-json="freshness_generated_at">
              {String(
                data.index.freshness_generated_at ?? data.freshness.generated_at ?? "—",
              )}
            </dd>
            <dt>{t("transparencyQaStatus")}</dt>
            <dd data-from-json="qa_status">
              {String(data.index.qa_status ?? data.qa.status)}
            </dd>
            <dt>{t("transparencyQaWarn")}</dt>
            <dd data-from-json="qa_n_warn">
              {String(data.index.qa_n_warn ?? data.qa.n_warn)}
            </dd>
            <dt>{t("transparencyQaBlock")}</dt>
            <dd data-from-json="qa_n_block">
              {String(data.index.qa_n_block ?? data.qa.n_block)}
            </dd>
            <dt>{t("transparencyLastRun")}</dt>
            <dd data-from-json="latest_run_id">
              {String(data.index.latest_run_id ?? data.run.run_id)}
            </dd>
            <dt>{t("transparencyLastRunStatus")}</dt>
            <dd data-from-json="latest_run_status">
              {String(data.index.latest_run_status ?? data.run.status)}
            </dd>
            <dt>{t("transparencyNSources")}</dt>
            <dd data-from-json="n_sources">{String(data.index.n_sources)}</dd>
            <dt>{t("transparencyNVariables")}</dt>
            <dd data-from-json="n_variables">{String(data.index.n_variables)}</dd>
            <dt>{t("spotCheckTitle")}</dt>
            <dd data-from-json="spot_check.status">{displayCell(data.spot.status)}</dd>
          </dl>
          {Array.isArray(data.spot.samples) &&
          (data.spot.samples as unknown[]).length > 0 ? (
            <section data-testid="spot-check-section">
              <h2>{t("spotCheckTitle")}</h2>
              <p className="muted small">
                {t("transparencySpotCheckAt")}: {displayCell(data.spot.generated_at)} ·
                matches=
                {displayCell(data.spot.matches)} · mismatches=
                {displayCell(data.spot.mismatches)} · unreachable=
                {displayCell(data.spot.unreachable)}
              </p>
              <div data-export-surface="table">
                <ExportMenu
                  testIdPrefix="spot-check"
                  kind="table"
                  title="Spot check"
                  tableRows={[
                    [
                      "variable_id",
                      "iso3",
                      "year",
                      "release_value",
                      "upstream_value",
                      "status",
                      "detail",
                    ],
                    ...(data.spot.samples as Record<string, unknown>[]).map((c) => [
                      String(c.variable_id ?? ""),
                      String(c.iso3 ?? ""),
                      String(c.year ?? ""),
                      String(c.release_value ?? ""),
                      String(c.upstream_value ?? ""),
                      String(c.status ?? ""),
                      String(c.detail ?? data.spot.note ?? ""),
                    ]),
                  ]}
                />
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("spotCheckVariable")}</th>
                      <th>{t("spotCheckIso")}</th>
                      <th>{t("spotCheckYear")}</th>
                      <th>{t("spotCheckExpected")}</th>
                      <th>{t("spotCheckObserved")}</th>
                      <th>{t("spotCheckResult")}</th>
                      <th>{t("spotCheckNote")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.spot.samples as Record<string, unknown>[]).map((c, i) => (
                      <tr key={i}>
                        <td>{displayCell(c.variable_id)}</td>
                        <td>{displayCell(c.iso3)}</td>
                        <td>{displayCell(c.year)}</td>
                        <td>{displayCell(c.release_value)}</td>
                        <td>{displayCell(c.upstream_value)}</td>
                        <td>{displayCell(c.status)}</td>
                        <td>{displayCell(c.detail ?? data.spot.note)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <p className="muted" data-testid="spot-check-empty">
              {displayCell(data.spot.note) !== "—"
                ? displayCell(data.spot.note)
                : t("spotCheckEmpty")}
            </p>
          )}

          <section data-testid="runs-calendar" className="runs-calendar">
            <h2>{t("runsCalendarTitle")}</h2>
            <p className="muted small">{t("runsCalendarIntro")}</p>
            {(data.updates.runs?.length ?? 0) === 0 ? (
              <p className="muted">{t("runsCalendarEmpty")}</p>
            ) : (
              <ul className="runs-calendar-list">
                {[...data.updates.runs]
                  .slice()
                  .reverse()
                  .slice(0, 30)
                  .map((r) => {
                    const tone = runTone(r.status);
                    const day = (r.started_at ?? r.run_id ?? "").slice(0, 10);
                    const summary =
                      r.summaries && r.summaries.length > 0
                        ? r.summaries.slice(0, 3).join("; ")
                        : lang === "es"
                          ? "Sin resumen de fuentes."
                          : "No source summary.";
                    return (
                      <li
                        key={r.run_id}
                        className={`runs-calendar-item runs-${tone}`}
                        data-testid={`run-${r.run_id}`}
                      >
                        <span className={`runs-dot runs-dot-${tone}`} aria-hidden />
                        <div>
                          <strong className="font-tabular">{day}</strong>{" "}
                          <span className="muted small">{r.run_id}</span>
                          <div className="small">
                            {t("runsCalendarStatus")}: {String(r.status ?? "—")}
                            {r.n_new_cells != null
                              ? ` · +${r.n_new_cells} ${t("runsCalendarNewCells")}`
                              : ""}
                          </div>
                          <p className="small muted">{summary}</p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          {(() => {
            const stateRows = data.sourcesState.sources ?? {};
            const freshRows = ((
              data.freshness as { sources?: Record<string, unknown>[] }
            ).sources ?? []) as Record<string, unknown>[];
            const ids = Array.from(
              new Set([
                ...Object.keys(stateRows),
                ...freshRows.map((s) => String(s.source ?? "")),
              ]),
            ).filter(Boolean);
            const ok = ids.filter((id) => {
              const row = stateRows[id];
              const fr = freshRows.find((s) => String(s.source) === id);
              const emoji = sourceEmoji(row, String(fr?.status ?? ""));
              return emoji === "🟢";
            }).length;
            const byTier = (tier: string) => {
              const list = ids.filter((id) => (stateRows[id]?.tier || "?") === tier);
              const okT = list.filter(
                (id) => sourceEmoji(stateRows[id]) === "🟢",
              ).length;
              return { total: list.length, ok: okT };
            };
            const a = byTier("A");
            const b = byTier("B");
            const c = byTier("C");
            return (
              <section data-testid="freshness-sources">
                <h2>{t("sourcesWorkingTitle")}</h2>
                <p
                  className="sources-working-count"
                  data-testid="sources-working-count"
                >
                  <strong className="font-tabular" style={{ fontSize: "1.75rem" }}>
                    {t("sourcesWorkingCount")
                      .replace("{ok}", String(ok))
                      .replace("{total}", String(ids.length))}
                  </strong>
                </p>
                <ul className="muted small" data-testid="sources-tier-summary">
                  <li>
                    {t("sourcesTierA")
                      .replace("{ok}", String(a.ok))
                      .replace("{total}", String(a.total))}
                  </li>
                  <li>
                    {t("sourcesTierB")
                      .replace("{ok}", String(b.ok))
                      .replace("{total}", String(b.total))}
                  </li>
                  <li>{t("sourcesTierC").replace("{total}", String(c.total))}</li>
                </ul>
                <table className="data-table small">
                  <thead>
                    <tr>
                      <th aria-label="estado" />
                      <th>{t("transparencySource")}</th>
                      <th>{t("sourcesColTier")}</th>
                      <th>{t("freshnessStatus")}</th>
                      <th>{t("freshnessVersion")}</th>
                      <th>{t("sourcesColRows")}</th>
                      <th>{t("sourcesColYear")}</th>
                      <th>{t("sourcesColChecked")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ids.map((id) => {
                      const row = stateRows[id];
                      const fr = freshRows.find((s) => String(s.source) === id);
                      const emoji = sourceEmoji(row, String(fr?.status ?? ""));
                      return (
                        <tr key={id}>
                          <td aria-label={emoji}>{emoji}</td>
                          <td>{displayCell(id)}</td>
                          <td>{displayCell(row?.tier ?? "—")}</td>
                          <td>
                            {displayCell(
                              row?.status ?? fr?.status ?? (fr?.stale ? "stale" : "ok"),
                            )}
                          </td>
                          <td className="font-tabular">
                            {displayCell(
                              row?.version ??
                                fr?.ingested_version ??
                                fr?.upstream_version,
                            )}
                          </td>
                          <td className="font-tabular">
                            {displayCell(row?.rows ?? "—")}
                          </td>
                          <td className="font-tabular">
                            {displayCell(row?.last_year ?? "—")}
                          </td>
                          <td className="font-tabular small">
                            {displayCell(row?.checked_at ?? fr?.checked_at ?? "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })()}
        </>
      )}
    </TransparencyShell>
  );
}
