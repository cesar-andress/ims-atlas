import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { TransparencyShell } from "../../components/TransparencyShell";
import { loadUpdates } from "../../data/transparency";
import { useTranslation } from "../../i18n";
import { useAsyncResource } from "../../state/useAsyncResource";

export function DataUpdates() {
  const { t } = useTranslation();
  const { data, error, loading } = useAsyncResource(() => loadUpdates(), []);

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
        <>
          <FixtureStatusBanner
            isFixture={Boolean(data.is_fixture)}
            message={data.fixture_banner ?? null}
          />
          {data.runs.length === 0 ? (
            <p className="muted" data-testid="updates-empty">
              {t("transparencyUpdatesEmpty")}
            </p>
          ) : (
            <ol className="updates-timeline" data-testid="updates-timeline">
              {data.runs.map((run) => (
                <li key={run.run_id} data-run-id={run.run_id}>
                  <h3>
                    <code>{run.run_id}</code>{" "}
                    <span className="muted small">
                      {run.mode ?? "—"} · {run.status ?? "—"} ·{" "}
                      {run.ended_at ?? run.started_at ?? "—"}
                    </span>
                  </h3>
                  {(run.summaries ?? []).length === 0 ? (
                    <p className="muted small">{t("transparencyUpdatesNoDiff")}</p>
                  ) : (
                    <ul>
                      {(run.summaries ?? []).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </TransparencyShell>
  );
}
