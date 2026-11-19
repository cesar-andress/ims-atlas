import { useTranslation } from "../../i18n";
import { TransparencyShell } from "../../components/TransparencyShell";
import {
  loadFreshness,
  loadIndex,
  loadLatestRun,
  loadQa,
} from "../../data/transparency";
import { useAsyncResource } from "../../state/useAsyncResource";

export function DataStatus() {
  const { t } = useTranslation();
  const { data, error, loading } = useAsyncResource(async () => {
    const [index, qa, freshness, run] = await Promise.all([
      loadIndex(),
      loadQa(),
      loadFreshness(),
      loadLatestRun(),
    ]);
    return { index, qa, freshness, run };
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
        </dl>
      )}
    </TransparencyShell>
  );
}
