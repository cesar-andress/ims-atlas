import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { TransparencyShell } from "../../components/TransparencyShell";
import {
  loadFreshness,
  loadIndex,
  loadLatestRun,
  loadQa,
  loadSpotCheck,
} from "../../data/transparency";
import { displayCell } from "../../formatDisplay";
import { useTranslation } from "../../i18n";
import { useAsyncResource } from "../../state/useAsyncResource";

export function DataStatus() {
  const { t } = useTranslation();
  const { data, error, loading } = useAsyncResource(async () => {
    const [index, qa, freshness, run, spot] = await Promise.all([
      loadIndex(),
      loadQa(),
      loadFreshness(),
      loadLatestRun(),
      loadSpotCheck().catch((): Record<string, unknown> => ({
        status: "missing",
        samples: [],
      })),
    ]);
    return { index, qa, freshness, run, spot };
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
            </section>
          ) : (
            <p className="muted" data-testid="spot-check-empty">
              {displayCell(data.spot.note) !== "—"
                ? displayCell(data.spot.note)
                : t("spotCheckEmpty")}
            </p>
          )}
        </>
      )}
    </TransparencyShell>
  );
}
