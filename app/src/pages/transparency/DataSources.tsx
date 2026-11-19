import { useTranslation } from "../../i18n";
import { TransparencyShell } from "../../components/TransparencyShell";
import { loadSources } from "../../data/transparency";
import { displayCell } from "../../formatDisplay";
import { useAsyncResource } from "../../state/useAsyncResource";

export function DataSources() {
  const { t } = useTranslation();
  const { data, error, loading } = useAsyncResource(
    () => loadSources().then((p) => p.sources),
    [],
  );

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
        <div className="table-scroll">
          <table data-testid="sources-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("transparencyPublisher")}</th>
                <th>{t("transparencyLicence")}</th>
                <th>{t("transparencyCadence")}</th>
                <th>{t("transparencyLastChecked")}</th>
                <th>{t("transparencyUpstreamChange")}</th>
                <th>{t("transparencyIngested")}</th>
                <th>{t("transparencyReleaseVersion")}</th>
                <th>{t("transparencyStale")}</th>
                <th>{t("transparencyLinks")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => {
                const fr = s.freshness ?? {};
                const rights = s.rights ?? {};
                return (
                  <tr key={s.id} data-source-id={s.id}>
                    <td data-from-json="id">{s.id}</td>
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
      )}
    </TransparencyShell>
  );
}
