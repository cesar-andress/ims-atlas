import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { TransparencyShell } from "../../components/TransparencyShell";
import { loadManifest, loadReleases } from "../../data/transparency";
import { displayCell } from "../../formatDisplay";

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
    <TransparencyShell
      testId="data-releases-view"
      titleKey="nav.data_releases"
      introKey="transparencyReleasesIntro"
    >
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
                    <td data-from-json="version">{displayCell(r.version)}</td>
                    <td data-from-json="created_at">{displayCell(r.created_at)}</td>
                    <td data-from-json="promoted_at">{displayCell(r.promoted_at)}</td>
                    <td data-from-json="promoted_by">{displayCell(r.promoted_by)}</td>
                    <td data-from-json="n_included_variables">
                      {displayCell(r.n_included_variables)}
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
                <dd data-from-json="manifest.created_at">
                  {displayCell(manifest.created_at)}
                </dd>
                <dt>promoted_at</dt>
                <dd data-from-json="manifest.promoted_at">
                  {displayCell(manifest.promoted_at)}
                </dd>
                <dt>n_included_variables</dt>
                <dd data-from-json="manifest.n_included_variables">
                  {displayCell(manifest.n_included_variables)}
                </dd>
                <dt>spec</dt>
                <dd data-from-json="manifest.spec">{displayCell(manifest.spec)}</dd>
              </dl>
            </section>
          ) : null}
        </>
      )}
    </TransparencyShell>
  );
}
