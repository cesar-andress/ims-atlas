import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { PermalinkLink } from "../../components/PermalinkLink";
import { TransparencyShell } from "../../components/TransparencyShell";
import { dataConfig } from "../../dataConfig";
import {
  humanizeSummaryLine,
  modeLabel,
  statusLabel,
  type UpdateLang,
} from "../../data/humanizeUpdates";
import {
  loadFreshness,
  loadIndex,
  loadLatestRun,
  loadQa,
  loadSources,
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

function sourceKind(
  row: SourcesStateRow | undefined,
  freshnessStatus?: string,
): "ok" | "fail" | "pending" | "unknown" {
  const st = (row?.status || freshnessStatus || "").toLowerCase();
  if (
    st.startsWith("falta") ||
    st.includes("file") ||
    st === "pending_file" ||
    st === "no_connector"
  ) {
    return "pending";
  }
  if (st === "fail" || st === "error" || (row?.consecutive_failures ?? 0) >= 3) {
    return "fail";
  }
  if (st === "ok" || st === "al_dia" || st === "fresh") {
    return "ok";
  }
  return "unknown";
}

function formatWhen(value: unknown, lang: UpdateLang): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(lang === "es" ? "es-ES" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatInt(n: unknown, lang: UpdateLang): string {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(lang === "es" ? "es-ES" : "en-GB");
}

function verdictCopy(
  status: string | null | undefined,
  t: (k: string) => string,
): { title: string; body: string; tone: "ok" | "warn" | "bad" } {
  const tone = runTone(status);
  if (tone === "ok") {
    return {
      tone,
      title: t("statusVerdictOkTitle"),
      body: t("statusVerdictOkBody"),
    };
  }
  if (tone === "warn") {
    return {
      tone,
      title: t("statusVerdictWarnTitle"),
      body: t("statusVerdictWarnBody"),
    };
  }
  return {
    tone,
    title: t("statusVerdictFailTitle"),
    body: t("statusVerdictFailBody"),
  };
}

export function DataStatus() {
  const { t, i18n } = useTranslation();
  const lang: UpdateLang = i18n.language.startsWith("es") ? "es" : "en";
  const { data, error, loading } = useAsyncResource(async () => {
    const [index, qa, freshness, run, spot, updates, sourcesState, sources] =
      await Promise.all([
        loadIndex(),
        loadQa(),
        loadFreshness(),
        loadLatestRun(),
        loadSpotCheck().catch((): Record<string, unknown> => ({
          status: "missing",
          samples: [],
        })),
        loadUpdates().catch(() => ({ runs: [] as const, n_runs: 0 })),
        loadSourcesState().catch((): SourcesStatePayload => ({ sources: {} })),
        loadSources().catch(() => ({
          sources: [] as { id: string; publisher?: string | null }[],
        })),
      ]);
    return { index, qa, freshness, run, spot, updates, sourcesState, sources };
  }, []);

  if (error) {
    return (
      <TransparencyShell
        testId="data-status-view"
        titleKey="nav.status"
        introKey="statusPageIntro"
      >
        <p className="error">{error}</p>
      </TransparencyShell>
    );
  }

  if (loading || !data) {
    return (
      <TransparencyShell
        testId="data-status-view"
        titleKey="nav.status"
        introKey="statusPageIntro"
      >
        <p className="muted">{t("loading")}</p>
      </TransparencyShell>
    );
  }

  const publishers = new Map<string, string>();
  for (const s of data.sources.sources ?? []) {
    if (s.id && s.publisher) publishers.set(s.id, s.publisher);
  }

  const dataVersion =
    (typeof data.index.current_release === "string" &&
      data.index.current_release.trim()) ||
    dataConfig.release_version;
  const lastStatus = String(data.index.latest_run_status ?? data.run.status ?? "");
  const lastRunId = String(data.index.latest_run_id ?? data.run.run_id ?? "");
  const lastWhen = formatWhen(
    (data.run as { ended_at?: string }).ended_at ??
      (data.run as { started_at?: string }).started_at ??
      data.index.freshness_generated_at,
    lang,
  );
  const verdict = verdictCopy(lastStatus, t);
  const qaWarn = Number(data.index.qa_n_warn ?? data.qa.n_warn ?? 0);
  const qaBlock = Number(data.index.qa_n_block ?? data.qa.n_block ?? 0);

  const stateRows = data.sourcesState.sources ?? {};
  const freshRows = ((data.freshness as { sources?: Record<string, unknown>[] })
    .sources ?? []) as Record<string, unknown>[];
  const ids = Array.from(
    new Set([
      ...Object.keys(stateRows),
      ...freshRows.map((s) => String(s.source ?? "")),
    ]),
  ).filter(Boolean);
  const okSources = ids.filter(
    (id) =>
      sourceKind(
        stateRows[id],
        String(freshRows.find((s) => String(s.source) === id)?.status ?? ""),
      ) === "ok",
  ).length;

  const recentRuns = [...(data.updates.runs ?? [])].slice().reverse().slice(0, 12);

  const spotNote =
    typeof data.spot.note === "string" && data.spot.note.trim() ? data.spot.note : null;
  const spotEmptyReason = spotNote?.toLowerCase().includes("provenance")
    ? t("statusSpotNoProvenance")
    : spotNote
      ? spotNote
      : t("spotCheckEmpty");

  return (
    <TransparencyShell
      testId="data-status-view"
      titleKey="nav.status"
      introKey="statusPageIntro"
    >
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

      <div className="status-page">
        <section
          className={`status-verdict results-card status-verdict-${verdict.tone}`}
          data-testid="status-verdict"
        >
          <p className="status-verdict-kicker muted small">
            {t("statusVerdictKicker")}
          </p>
          <h2>{verdict.title}</h2>
          <p className="status-verdict-body">{verdict.body}</p>
          <dl className="status-verdict-meta">
            <div>
              <dt>{t("dataVersion")}</dt>
              <dd data-testid="status-data-version">
                {dataVersion ? (
                  <a
                    href={`${dataConfig.release_base_path}/v${dataVersion}/manifest.json`}
                  >
                    v{dataVersion}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>{t("statusLastIngest")}</dt>
              <dd>
                <span
                  className={`updates-status updates-status-${verdict.tone === "bad" ? "fail" : verdict.tone}`}
                >
                  {statusLabel(lastStatus, lang)}
                </span>
                <span className="muted"> · {lastWhen}</span>
              </dd>
            </div>
            <div>
              <dt>{t("statusWhatToDo")}</dt>
              <dd className="small">
                {verdict.tone === "ok"
                  ? t("statusNextOk")
                  : verdict.tone === "warn"
                    ? t("statusNextWarn")
                    : t("statusNextFail")}
              </dd>
            </div>
          </dl>
          <p className="muted small status-run-id">
            {t("statusRunId")}: <code>{lastRunId || "—"}</code>
          </p>
        </section>

        <div className="status-kpis" data-testid="status-summary">
          <div className="status-kpi results-card">
            <p className="status-kpi-label">{t("transparencyNSources")}</p>
            <p className="status-kpi-value font-tabular">
              {formatInt(data.index.n_sources, lang)}
            </p>
            <p className="muted small">{t("statusKpiSourcesHint")}</p>
          </div>
          <div className="status-kpi results-card">
            <p className="status-kpi-label">{t("transparencyNVariables")}</p>
            <p className="status-kpi-value font-tabular">
              {formatInt(data.index.n_variables, lang)}
            </p>
            <p className="muted small">{t("statusKpiVarsHint")}</p>
          </div>
          <div className="status-kpi results-card">
            <p className="status-kpi-label">{t("statusSourcesOk")}</p>
            <p className="status-kpi-value font-tabular">
              {okSources}/{ids.length || "—"}
            </p>
            <p className="muted small">{t("statusSourcesOkHint")}</p>
          </div>
          <div className="status-kpi results-card">
            <p className="status-kpi-label">{t("transparencyQaStatus")}</p>
            <p className="status-kpi-value font-tabular">
              {qaBlock > 0
                ? t("statusQaBlocked")
                : qaWarn > 0
                  ? t("statusQaWarns").replace("{n}", String(qaWarn))
                  : t("statusQaClean")}
            </p>
            <p className="muted small">
              {t("statusQaHint")
                .replace("{warn}", String(qaWarn))
                .replace("{block}", String(qaBlock))}
            </p>
          </div>
        </div>

        <section
          className="results-card status-section"
          data-testid="spot-check-section"
        >
          <h3>{t("spotCheckTitle")}</h3>
          <p className="muted small">{t("statusSpotLead")}</p>
          {Array.isArray(data.spot.samples) &&
          (data.spot.samples as unknown[]).length > 0 ? (
            <p className="small">
              {t("transparencySpotCheckAt")}: {formatWhen(data.spot.generated_at, lang)}{" "}
              ·{" "}
              {t("statusSpotCounts")
                .replace("{ok}", String(data.spot.matches ?? 0))
                .replace("{bad}", String(data.spot.mismatches ?? 0))
                .replace("{miss}", String(data.spot.unreachable ?? 0))}
            </p>
          ) : (
            <p className="status-callout" data-testid="spot-check-empty">
              {spotEmptyReason}
            </p>
          )}
        </section>

        <section className="results-card status-section" data-testid="runs-calendar">
          <header className="status-section-head">
            <div>
              <h3>{t("runsCalendarTitle")}</h3>
              <p className="muted small">{t("runsCalendarIntro")}</p>
            </div>
            <PermalinkLink view="data_sources" hash="novedades" className="btn ghost">
              {t("statusOpenNovedades")}
            </PermalinkLink>
          </header>
          {recentRuns.length === 0 ? (
            <p className="muted">{t("runsCalendarEmpty")}</p>
          ) : (
            <ul className="status-runs-list">
              {recentRuns.map((r) => {
                const tone = runTone(r.status);
                const summaries = (r.summaries ?? [])
                  .slice(0, 3)
                  .map((line) => humanizeSummaryLine(line, lang, publishers));
                return (
                  <li
                    key={r.run_id}
                    className={`status-run-item status-run-${tone}`}
                    data-testid={`run-${r.run_id}`}
                  >
                    <span className={`runs-dot runs-dot-${tone}`} aria-hidden />
                    <div className="status-run-body">
                      <p className="status-run-title">
                        <strong className="font-tabular">
                          {formatWhen(r.ended_at ?? r.started_at, lang)}
                        </strong>{" "}
                        <span
                          className={`updates-status updates-status-${tone === "bad" ? "fail" : tone}`}
                        >
                          {statusLabel(r.status, lang)}
                        </span>
                        <span className="muted small">
                          {" "}
                          · {modeLabel(r.mode, lang)}
                        </span>
                      </p>
                      <p className="small muted">
                        {r.n_new_cells != null
                          ? t("updatesNewCells").replace(
                              "{n}",
                              formatInt(r.n_new_cells, lang),
                            )
                          : null}
                        {r.n_new_cells != null ? " · " : null}
                        <code className="small">{r.run_id}</code>
                      </p>
                      {summaries.length ? (
                        <ul className="status-run-summaries">
                          {summaries.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="small muted">{t("transparencyUpdatesNoDiff")}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className="results-card status-section"
          data-testid="freshness-sources"
        >
          <h3>{t("sourcesWorkingTitle")}</h3>
          <p className="muted small">{t("statusSourcesLead")}</p>
          <p className="sources-working-count" data-testid="sources-working-count">
            <strong className="font-tabular">
              {t("sourcesWorkingCount")
                .replace("{ok}", String(okSources))
                .replace("{total}", String(ids.length))}
            </strong>
          </p>
          <div className="table-scroll">
            <table className="data-table small">
              <thead>
                <tr>
                  <th>{t("freshnessStatus")}</th>
                  <th>{t("transparencySource")}</th>
                  <th>{t("sourcesColTier")}</th>
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
                  const kind = sourceKind(row, String(fr?.status ?? ""));
                  const label =
                    kind === "ok"
                      ? t("sourcesEmojiOk")
                      : kind === "fail"
                        ? t("sourcesEmojiFail")
                        : kind === "pending"
                          ? t("sourcesEmojiFile")
                          : t("sourcesEmojiPending");
                  const pub = publishers.get(id);
                  return (
                    <tr key={id}>
                      <td>
                        <span className={`status-source-pill status-source-${kind}`}>
                          {label}
                        </span>
                      </td>
                      <td>
                        <code>{displayCell(id)}</code>
                        {pub ? <div className="muted small">{pub}</div> : null}
                      </td>
                      <td>{displayCell(row?.tier ?? "—")}</td>
                      <td className="font-tabular">
                        {displayCell(
                          row?.version ?? fr?.ingested_version ?? fr?.upstream_version,
                        )}
                      </td>
                      <td className="font-tabular">
                        {typeof row?.rows === "number"
                          ? formatInt(row.rows, lang)
                          : "—"}
                      </td>
                      <td className="font-tabular">
                        {displayCell(row?.last_year ?? "—")}
                      </td>
                      <td className="font-tabular small">
                        {formatWhen(row?.checked_at ?? fr?.checked_at ?? null, lang)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </TransparencyShell>
  );
}
