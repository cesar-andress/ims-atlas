import { useMemo } from "react";
import { version as APP_VERSION } from "@ims-atlas/core";
import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { PermalinkLink } from "../../components/PermalinkLink";
import { TransparencyShell } from "../../components/TransparencyShell";
import { dataConfig, releaseUrl } from "../../dataConfig";
import {
  changelogBlocksForAppVersion,
  humanizeSummaryLine,
  modeLabel,
  statusLabel,
  type UpdateLang,
} from "../../data/humanizeUpdates";
import { loadReleases, loadSources, loadUpdates } from "../../data/transparency";
import { useTranslation } from "../../i18n";
import { useAsyncResource } from "../../state/useAsyncResource";
import rawChangelog from "../../../../CHANGELOG.md?raw";

type ChangelogBlock = { heading: string; body: string };

function parseChangelog(md: string): ChangelogBlock[] {
  const lines = md.split(/\r?\n/);
  const blocks: ChangelogBlock[] = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    if (!heading) return;
    blocks.push({ heading, body: body.join("\n").trim() });
    body = [];
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      heading = line.replace(/^##\s+/, "");
      continue;
    }
    if (heading) body.push(line);
  }
  flush();
  return blocks;
}

function formatWhen(value: unknown, lang: UpdateLang): string {
  if (typeof value !== "string" || !value.trim()) return "-";
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

function statusClass(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "ok") return "ok";
  if (s === "failed") return "fail";
  if (s.includes("qa")) return "warn";
  return "muted";
}

function bulletPreview(body: string, max = 6): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.replace(/^-+\s*/, ""))
    .slice(0, max);
}

export function DataUpdates() {
  const { t, i18n } = useTranslation();
  const lang: UpdateLang = i18n.language.startsWith("es") ? "es" : "en";
  const { data, error, loading } = useAsyncResource(async () => {
    const [updates, sources, releases] = await Promise.all([
      loadUpdates(),
      loadSources().catch(() => ({
        sources: [] as { id: string; publisher?: string | null }[],
      })),
      loadReleases().catch(() => null),
    ]);
    return { updates, sources, releases };
  }, []);

  const publishers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data?.sources.sources ?? []) {
      if (s.id && s.publisher) map.set(s.id, s.publisher);
    }
    return map;
  }, [data?.sources]);

  const dataVersion = useMemo(() => {
    const current =
      typeof data?.releases?.current === "string" ? data.releases.current.trim() : "";
    return current || dataConfig.release_version;
  }, [data?.releases]);

  const appBlocks = useMemo(() => {
    const all = parseChangelog(rawChangelog);
    return changelogBlocksForAppVersion(all, APP_VERSION);
  }, []);

  const runs = data?.updates.runs ?? [];

  return (
    <TransparencyShell
      testId="data-updates-view"
      titleKey="nav.data_updates"
      introKey="transparencyUpdatesIntro"
    >
      {error ? <p className="error">{error}</p> : null}
      {loading || !data ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <div className="updates-page">
          <FixtureStatusBanner
            isFixture={Boolean(data.updates.is_fixture)}
            message={data.updates.fixture_banner ?? null}
          />

          <section className="updates-version-bar results-card">
            <div className="updates-version-card">
              <p className="updates-version-label">{t("appVersion")}</p>
              <p className="updates-version-value" data-testid="updates-app-version">
                v{APP_VERSION}
              </p>
              <p className="muted small">{t("updatesAppVersionHint")}</p>
            </div>
            <div className="updates-version-card">
              <p className="updates-version-label">{t("dataVersion")}</p>
              <p className="updates-version-value" data-testid="updates-data-version">
                {dataVersion ? (
                  <a
                    href={`${dataConfig.release_base_path}/v${dataVersion}/manifest.json`}
                  >
                    v{dataVersion}
                  </a>
                ) : (
                  "-"
                )}
              </p>
              <p className="muted small">{t("updatesDataVersionHint")}</p>
            </div>
            <div className="updates-version-card updates-version-links">
              <PermalinkLink view="changelog" className="btn">
                {t("updatesOpenAppChangelog")}
              </PermalinkLink>
              <a className="btn ghost" href={releaseUrl("CHANGELOG.md")}>
                {t("updatesOpenDataChangelog")}
              </a>
            </div>
          </section>

          <section
            className="results-card updates-app-block"
            data-testid="updates-app-changelog"
            aria-labelledby="updates-app-title"
          >
            <header className="updates-section-head">
              <h3 id="updates-app-title">{t("updatesAppChangesTitle")}</h3>
              <p className="muted small">
                {t("updatesAppChangesLead").replace("{version}", APP_VERSION)}
              </p>
            </header>
            {appBlocks.map((b) => {
              const bullets = bulletPreview(b.body, 8);
              return (
                <article key={b.heading} className="updates-changelog-slice">
                  <h4>{b.heading}</h4>
                  {bullets.length ? (
                    <ul>
                      {bullets.map((line) => (
                        <li key={line.slice(0, 80)}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">{t("updatesAppChangesEmpty")}</p>
                  )}
                </article>
              );
            })}
          </section>

          <section
            className="results-card updates-ingest-block"
            aria-labelledby="updates-ingest-title"
          >
            <header className="updates-section-head">
              <h3 id="updates-ingest-title">{t("updatesIngestTitle")}</h3>
              <p className="muted small">
                {t("updatesIngestLead").replace(
                  "{version}",
                  dataVersion ? `v${dataVersion}` : "-",
                )}
              </p>
            </header>

            {runs.length === 0 ? (
              <p className="muted" data-testid="updates-empty">
                {t("transparencyUpdatesEmpty")}
              </p>
            ) : (
              <ol className="updates-timeline" data-testid="updates-timeline">
                {runs.map((run) => {
                  const when = formatWhen(run.ended_at ?? run.started_at, lang);
                  const st = statusLabel(run.status, lang);
                  const mode = modeLabel(run.mode, lang);
                  const summaries = run.summaries ?? [];
                  return (
                    <li
                      key={run.run_id}
                      data-run-id={run.run_id}
                      className="updates-run"
                    >
                      <header className="updates-run-head">
                        <div>
                          <p className="updates-run-when font-tabular">{when}</p>
                          <p className="updates-run-meta muted small">
                            <span
                              className={`updates-status updates-status-${statusClass(run.status)}`}
                            >
                              {st}
                            </span>
                            <span aria-hidden> · </span>
                            <span>{mode}</span>
                            {typeof run.n_new_cells === "number" &&
                            run.n_new_cells > 0 ? (
                              <>
                                <span aria-hidden> · </span>
                                <span>
                                  {t("updatesNewCells").replace(
                                    "{n}",
                                    String(
                                      run.n_new_cells.toLocaleString(
                                        lang === "es" ? "es-ES" : "en-GB",
                                      ),
                                    ),
                                  )}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <code className="updates-run-id muted small" title={run.run_id}>
                          {run.run_id}
                        </code>
                      </header>
                      {summaries.length === 0 ? (
                        <p className="muted small">{t("transparencyUpdatesNoDiff")}</p>
                      ) : (
                        <ul className="updates-summary-list">
                          {summaries.map((line) => (
                            <li key={line}>
                              {humanizeSummaryLine(line, lang, publishers)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </TransparencyShell>
  );
}
