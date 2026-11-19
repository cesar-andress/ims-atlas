import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import {
  loadFreshness,
  loadIndex,
  loadLatestRun,
  loadQa,
  type TransparencyIndex,
} from "../../data/transparency";

export function DataStatus() {
  const { t } = useTranslation();
  const [index, setIndex] = useState<TransparencyIndex | null>(null);
  const [qa, setQa] = useState<Record<string, unknown> | null>(null);
  const [freshness, setFreshness] = useState<Record<string, unknown> | null>(null);
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [i, q, f, r] = await Promise.all([
          loadIndex(),
          loadQa(),
          loadFreshness(),
          loadLatestRun(),
        ]);
        if (cancelled) return;
        setIndex(i);
        setQa(q);
        setFreshness(f);
        setRun(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell testId="data-status-view" titleKey="nav.status">
      <p className="muted">{t("transparencyIntro")}</p>
      <nav className="transparency-nav" aria-label={t("transparencyNav")}>
        <PermalinkLink view="data_sources">{t("nav.data_sources")}</PermalinkLink>
        <PermalinkLink view="data_pipeline">{t("nav.data_pipeline")}</PermalinkLink>
        <PermalinkLink view="data_releases">{t("nav.data_releases")}</PermalinkLink>
      </nav>
      {error ? <p className="error">{error}</p> : null}
      {!index || !qa || !freshness || !run ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <dl className="status-grid" data-testid="status-summary">
          <dt>{t("transparencyRelease")}</dt>
          <dd data-from-json="current_release">{index.current_release}</dd>
          <dt>{t("transparencyFreshnessAt")}</dt>
          <dd data-from-json="freshness_generated_at">
            {String(index.freshness_generated_at ?? freshness.generated_at ?? "—")}
          </dd>
          <dt>{t("transparencyQaStatus")}</dt>
          <dd data-from-json="qa_status">{String(index.qa_status ?? qa.status)}</dd>
          <dt>{t("transparencyQaWarn")}</dt>
          <dd data-from-json="qa_n_warn">{String(index.qa_n_warn ?? qa.n_warn)}</dd>
          <dt>{t("transparencyQaBlock")}</dt>
          <dd data-from-json="qa_n_block">{String(index.qa_n_block ?? qa.n_block)}</dd>
          <dt>{t("transparencyLastRun")}</dt>
          <dd data-from-json="latest_run_id">
            {String(index.latest_run_id ?? run.run_id)}
          </dd>
          <dt>{t("transparencyLastRunStatus")}</dt>
          <dd data-from-json="latest_run_status">
            {String(index.latest_run_status ?? run.status)}
          </dd>
          <dt>{t("transparencyNSources")}</dt>
          <dd data-from-json="n_sources">{String(index.n_sources)}</dd>
          <dt>{t("transparencyNVariables")}</dt>
          <dd data-from-json="n_variables">{String(index.n_variables)}</dd>
        </dl>
      )}
    </PageShell>
  );
}
