import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { loadManifest, loadReleases } from "../../data/transparency";

function str(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function DataReleases() {
  const { t } = useTranslation();
  const [releases, setReleases] = useState<Record<string, unknown>[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await loadReleases();
        if (cancelled) return;
        setReleases(payload.releases);
        setCurrent(payload.current);
        const first = payload.releases[0];
        const path =
          first && typeof first.manifest_path === "string" ? first.manifest_path : null;
        if (path) {
          const m = await loadManifest(path);
          if (!cancelled) setManifest(m);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell testId="data-releases-view" titleKey="nav.data_releases">
      <p className="muted">{t("transparencyReleasesIntro")}</p>
      <nav className="transparency-nav" aria-label={t("transparencyNav")}>
        <PermalinkLink view="status">{t("nav.status")}</PermalinkLink>
        <PermalinkLink view="data_sources">{t("nav.data_sources")}</PermalinkLink>
        <PermalinkLink view="data_pipeline">{t("nav.data_pipeline")}</PermalinkLink>
      </nav>
      {error ? <p className="error">{error}</p> : null}
      {!releases || !current ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <>
          <p>
            {t("transparencyCurrentRelease")}:{" "}
            <strong data-from-json="current" data-testid="current-release">
              {current}
            </strong>
          </p>
          <div className="table-scroll">
            <table data-testid="releases-table">
              <thead>
                <tr>
                  <th>{t("transparencyVersion")}</th>
                  <th>{t("transparencyCreated")}</th>
                  <th>{t("transparencyPromoted")}</th>
                  <th>{t("transparencyPromotedBy")}</th>
                  <th>{t("transparencyIncludedVars")}</th>
                  <th>manifest</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={String(r.version)}>
                    <td data-from-json="version">{str(r.version)}</td>
                    <td data-from-json="created_at">{str(r.created_at)}</td>
                    <td data-from-json="promoted_at">{str(r.promoted_at)}</td>
                    <td data-from-json="promoted_by">{str(r.promoted_by)}</td>
                    <td data-from-json="n_included_variables">
                      {str(r.n_included_variables)}
                    </td>
                    <td>
                      {typeof r.manifest_path === "string" ? (
                        <a href={r.manifest_path}>{r.manifest_path}</a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {manifest ? (
            <section data-testid="manifest-summary">
              <h2>{t("transparencyManifest")}</h2>
              <dl className="status-grid">
                <dt>created_at</dt>
                <dd data-from-json="manifest.created_at">{str(manifest.created_at)}</dd>
                <dt>promoted_at</dt>
                <dd data-from-json="manifest.promoted_at">
                  {str(manifest.promoted_at)}
                </dd>
                <dt>n_included_variables</dt>
                <dd data-from-json="manifest.n_included_variables">
                  {str(manifest.n_included_variables)}
                </dd>
                <dt>spec</dt>
                <dd data-from-json="manifest.spec">{str(manifest.spec)}</dd>
              </dl>
            </section>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
