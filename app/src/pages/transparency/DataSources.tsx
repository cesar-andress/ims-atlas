import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { loadSources, type TransparencySource } from "../../data/transparency";

function str(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function DataSources() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<TransparencySource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSources()
      .then((payload) => {
        if (!cancelled) setRows(payload.sources);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell testId="data-sources-view" titleKey="nav.data_sources">
      <p className="muted">{t("transparencySourcesIntro")}</p>
      <nav className="transparency-nav" aria-label={t("transparencyNav")}>
        <PermalinkLink view="status">{t("nav.status")}</PermalinkLink>
        <PermalinkLink view="data_pipeline">{t("nav.data_pipeline")}</PermalinkLink>
        <PermalinkLink view="data_releases">{t("nav.data_releases")}</PermalinkLink>
      </nav>
      {error ? <p className="error">{error}</p> : null}
      {!rows ? (
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
              {rows.map((s) => {
                const fr = s.freshness ?? {};
                const rights = s.rights ?? {};
                return (
                  <tr key={s.id} data-source-id={s.id}>
                    <td data-from-json="id">{s.id}</td>
                    <td data-from-json="publisher">{str(s.publisher)}</td>
                    <td data-from-json="licence_id">{str(rights.licence_id)}</td>
                    <td data-from-json="update_cadence">{str(s.update_cadence)}</td>
                    <td data-from-json="checked_at">{str(fr.checked_at)}</td>
                    <td data-from-json="upstream_changed_at">
                      {str(fr.upstream_changed_at)}
                    </td>
                    <td data-from-json="ingested_version">
                      {str(fr.ingested_version)}
                    </td>
                    <td data-from-json="release_version">{str(s.release_version)}</td>
                    <td data-from-json="stale">{str(fr.stale)}</td>
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
    </PageShell>
  );
}
