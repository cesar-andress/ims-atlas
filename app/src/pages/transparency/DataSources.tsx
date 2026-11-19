import { AccessBadge } from "../../components/AccessBadge";
import { CopyUrlButton } from "../../components/CopyUrlButton";
import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { TransparencyShell } from "../../components/TransparencyShell";
import { loadSources } from "../../data/transparency";
import { displayCell } from "../../formatDisplay";
import { useTranslation } from "../../i18n";
import { useAsyncResource } from "../../state/useAsyncResource";

export function DataSources() {
  const { t } = useTranslation();
  const { data, error, loading } = useAsyncResource(() => loadSources(), []);

  return (
    <TransparencyShell
      testId="data-sources-view"
      titleKey="nav.data_sources"
      introKey="transparencySourcesIntro"
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
          <div className="table-scroll">
            <table data-testid="sources-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("transparencyAccess")}</th>
                  <th>{t("transparencyPublisher")}</th>
                  <th>{t("transparencyLicence")}</th>
                  <th>{t("transparencyCadence")}</th>
                  <th>{t("transparencyLastChecked")}</th>
                  <th>{t("transparencyUpstreamChange")}</th>
                  <th>{t("transparencyIngested")}</th>
                  <th>{t("transparencyReleaseVersion")}</th>
                  <th>{t("transparencyStale")}</th>
                  <th>{t("transparencyRightsCheckedBy")}</th>
                  <th>{t("transparencyRightsCheckedOn")}</th>
                  <th>{t("transparencyTermsHash")}</th>
                  <th>{t("transparencyTermsChanged")}</th>
                  <th>{t("transparencyLinks")}</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => {
                  const fr = s.freshness ?? {};
                  const rights = s.rights ?? {};
                  const evidence =
                    (rights.evidence as Record<string, unknown> | undefined) ?? {};
                  return (
                    <tr key={s.id} data-source-id={s.id}>
                      <td data-from-json="id">{s.id}</td>
                      <td>
                        <AccessBadge
                          kind="source"
                          store={s.store ?? null}
                          rights={rights}
                        />
                      </td>
                      <td data-from-json="publisher">{displayCell(s.publisher)}</td>
                      <td data-from-json="licence_id">
                        {displayCell(rights.licence_id)}
                      </td>
                      <td data-from-json="update_cadence">
                        {displayCell(s.update_cadence)}
                      </td>
                      <td data-from-json="checked_at">{displayCell(fr.checked_at)}</td>
                      <td data-from-json="upstream_changed_at">
                        {displayCell(fr.upstream_changed_at)}
                      </td>
                      <td data-from-json="ingested_version">
                        {displayCell(fr.ingested_version)}
                      </td>
                      <td data-from-json="release_version">
                        {displayCell(s.release_version)}
                      </td>
                      <td data-from-json="stale">{displayCell(fr.stale)}</td>
                      <td data-from-json="evidence.checked_by">
                        {displayCell(evidence.checked_by)}
                      </td>
                      <td data-from-json="evidence.checked_on">
                        {displayCell(evidence.checked_on)}
                      </td>
                      <td data-from-json="evidence.snapshot_sha256">
                        {typeof evidence.snapshot_sha256 === "string" &&
                        evidence.snapshot_sha256.length > 0
                          ? `${String(evidence.snapshot_sha256).slice(0, 12)}…`
                          : "—"}
                      </td>
                      <td data-from-json="terms_changed">
                        {displayCell((fr as { terms_changed?: unknown }).terms_changed)}
                      </td>
                      <td>
                        {s.landing_url ? (
                          <a
                            href={s.landing_url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            landing
                          </a>
                        ) : (
                          "—"
                        )}
                        {s.terms_url ? (
                          <>
                            {" · "}
                            <a
                              href={s.terms_url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              terms
                            </a>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <section className="endpoint-list" data-testid="sources-endpoints">
            <h3>{t("transparencyEndpoints")}</h3>
            {data.sources.map((s) =>
              (s.endpoints ?? []).map((ep) =>
                ep.template ? (
                  <p key={`${s.id}-${ep.id ?? ep.template}`}>
                    <strong>{s.id}</strong>
                    {ep.id ? ` / ${ep.id}` : ""}:{" "}
                    <CopyUrlButton url={String(ep.template)} />
                  </p>
                ) : null,
              ),
            )}
          </section>
        </>
      )}
    </TransparencyShell>
  );
}
