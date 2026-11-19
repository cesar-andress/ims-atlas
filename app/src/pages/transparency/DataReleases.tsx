import { useTranslation } from "../../i18n";
import { ExportMenu } from "../../components/ExportMenu";
import { TransparencyShell } from "../../components/TransparencyShell";
import { loadManifest, loadReleases } from "../../data/transparency";
import { displayCell } from "../../formatDisplay";
import { useAsyncResource } from "../../state/useAsyncResource";

export function DataReleases() {
  const { t } = useTranslation();
  const { data, error, loading } = useAsyncResource(async () => {
    const payload = await loadReleases();
    const first = payload.releases[0];
    const path =
      first && typeof first.manifest_path === "string" ? first.manifest_path : null;
    const manifest = path ? await loadManifest(path) : null;
    return {
      releases: payload.releases,
      current: payload.current,
      manifest,
      releasesPayload: payload,
    };
  }, []);

  return (
    <TransparencyShell
      testId="data-releases-view"
      titleKey="nav.data_releases"
      introKey="transparencyReleasesIntro"
    >
      {error ? <p className="error">{error}</p> : null}
      {loading || !data?.releases || !data.current ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <>
          <p>
            {t("transparencyCurrentRelease")}:{" "}
            <strong data-from-json="current" data-testid="current-release">
              {data.current}
            </strong>
          </p>
          <div className="table-scroll" data-export-surface="table">
            <ExportMenu
              testIdPrefix="releases"
              kind="table"
              title="Data releases"
              tableRows={[
                [
                  "version",
                  "created_at",
                  "promoted_at",
                  "promoted_by",
                  "n_included_variables",
                  "manifest_path",
                ],
                ...data.releases.map((r) => [
                  String(r.version ?? ""),
                  String(r.created_at ?? ""),
                  String(r.promoted_at ?? ""),
                  String(r.promoted_by ?? ""),
                  String(r.n_included_variables ?? ""),
                  typeof r.manifest_path === "string" ? r.manifest_path : "",
                ]),
              ]}
            />
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
                {data.releases.map((r) => (
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

          {data.manifest ? (
            <section data-testid="manifest-summary">
              <h2>{t("transparencyManifest")}</h2>
              <dl className="status-grid">
                <dt>created_at</dt>
                <dd data-from-json="manifest.created_at">
                  {displayCell(data.manifest.created_at)}
                </dd>
                <dt>promoted_at</dt>
                <dd data-from-json="manifest.promoted_at">
                  {displayCell(data.manifest.promoted_at)}
                </dd>
                <dt>n_included_variables</dt>
                <dd data-from-json="manifest.n_included_variables">
                  {displayCell(data.manifest.n_included_variables)}
                </dd>
                <dt>spec</dt>
                <dd data-from-json="manifest.spec">
                  {displayCell(data.manifest.spec)}
                </dd>
                <dt>{t("transparencySignature")}</dt>
                <dd data-from-json="manifest.signature">
                  {displayCell(
                    (data.manifest.signature as { status?: string } | undefined)
                      ?.status ??
                      (data.releasesPayload as { signature?: { status?: string } })
                        ?.signature?.status ??
                      "unsigned",
                  )}
                </dd>
                <dt>{t("transparencySha256sums")}</dt>
                <dd>
                  <a
                    href={
                      (data.releasesPayload as { sha256sums_path?: string })
                        ?.sha256sums_path ?? `/data/v${data.current}/SHA256SUMS`
                    }
                  >
                    SHA256SUMS
                  </a>
                </dd>
              </dl>
            </section>
          ) : null}
        </>
      )}
    </TransparencyShell>
  );
}
