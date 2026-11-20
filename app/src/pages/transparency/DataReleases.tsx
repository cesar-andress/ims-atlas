import { useMemo } from "react";
import { ExportMenu } from "../../components/ExportMenu";
import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { TransparencyShell } from "../../components/TransparencyShell";
import { dataConfig, releaseUrl } from "../../dataConfig";
import { loadReleases } from "../../data/transparency";
import { displayCell } from "../../formatDisplay";
import { useTranslation } from "../../i18n";
import { useAsyncResource } from "../../state/useAsyncResource";

type ReleaseRow = {
  version?: string | null;
  audience?: string | null;
  created_at?: string | null;
  promoted_at?: string | null;
  promoted_by?: string | null;
  n_included_variables?: number | null;
  manifest_path?: string | null;
  row_counts?: {
    trade_rows?: number;
    country_year_rows?: number;
    bilateral_year_rows?: number;
    country_product_rows?: number;
  } | null;
  size_bytes?: {
    total_bytes?: number;
    largest_path?: string;
    largest_bytes?: number;
  } | null;
};

function formatWhen(value: unknown, lang: "es" | "en"): string {
  if (typeof value !== "string" || !value.trim()) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(lang === "es" ? "es-ES" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(n: number | null | undefined, lang: "es" | "en"): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const locale = lang === "es" ? "es-ES" : "en-GB";
  return `${v.toLocaleString(locale, { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}

function formatInt(n: number | null | undefined, lang: "es" | "en"): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString(lang === "es" ? "es-ES" : "en-GB");
}

function resolveCurrent(
  payload: { current?: unknown; releases?: ReleaseRow[] } | null,
): string {
  const fromPayload =
    typeof payload?.current === "string" ? payload.current.trim() : "";
  if (fromPayload) return fromPayload;
  const fromRow = payload?.releases?.find((r) => r.version)?.version;
  if (typeof fromRow === "string" && fromRow.trim()) return fromRow.trim();
  return dataConfig.release_version;
}

export function DataReleases() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { data, error, loading } = useAsyncResource(async () => {
    try {
      return await loadReleases();
    } catch {
      return null;
    }
  }, []);

  const current = resolveCurrent(data);
  const releases = (data?.releases ?? []) as ReleaseRow[];
  const publicRelease =
    releases.find((r) => r.audience === "public" || r.version === current) ??
    releases[0] ??
    null;
  const internal = (data as { internal?: ReleaseRow } | null)?.internal ?? null;

  const kpis = useMemo(() => {
    const row = publicRelease;
    const counts = row?.row_counts ?? {};
    return [
      {
        id: "version",
        label: t("transparencyVersion"),
        value: current ? `v${current}` : "-",
      },
      {
        id: "vars",
        label: t("transparencyIncludedVars"),
        value: formatInt(row?.n_included_variables, lang),
      },
      {
        id: "trade",
        label: t("releasesTradeRows"),
        value: formatInt(counts.trade_rows, lang),
      },
      {
        id: "size",
        label: t("releasesSize"),
        value: formatBytes(row?.size_bytes?.total_bytes, lang),
      },
    ];
  }, [current, publicRelease, lang, t]);

  const manifestHref =
    (typeof publicRelease?.manifest_path === "string" && publicRelease.manifest_path) ||
    releaseUrl("manifest.json");
  const shaHref =
    (typeof data?.sha256sums_path === "string" && data.sha256sums_path) ||
    `/data/v${current}/SHA256SUMS`;

  return (
    <TransparencyShell
      testId="data-releases-view"
      titleKey="nav.data_releases"
      introKey="transparencyReleasesIntro"
    >
      {data && "is_fixture" in data ? (
        <FixtureStatusBanner
          isFixture={Boolean((data as { is_fixture?: boolean }).is_fixture)}
        />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {loading && !data ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <div className="releases-page">
          <section
            className="releases-hero results-card"
            aria-labelledby="releases-current"
          >
            <p className="releases-kicker muted small">
              {t("transparencyCurrentRelease")}
            </p>
            <h2
              id="releases-current"
              data-testid="current-release"
              data-from-json="current"
            >
              {current ? `v${current}` : t("releasesVersionMissing")}
            </h2>
            <p className="releases-hero-meta muted">
              {publicRelease ? (
                <>
                  {t("transparencyPromoted")}:{" "}
                  {formatWhen(publicRelease.promoted_at, lang)}
                  {" · "}
                  {t("transparencyPromotedBy")}:{" "}
                  {displayCell(publicRelease.promoted_by)}
                </>
              ) : (
                t("releasesFallbackConfig")
              )}
            </p>
            <div className="releases-hero-actions">
              <a
                className="btn"
                href={manifestHref}
                data-testid="releases-manifest-link"
              >
                {t("releasesOpenManifest")}
              </a>
              <a className="btn ghost" href={shaHref}>
                SHA256SUMS
              </a>
              <a className="btn ghost" href={releaseUrl("")}>
                {t("releasesBrowseFiles")}
              </a>
            </div>
          </section>

          <div className="releases-kpis" role="list">
            {kpis.map((k) => (
              <div key={k.id} className="releases-kpi results-card" role="listitem">
                <p className="releases-kpi-label">{k.label}</p>
                <p className="releases-kpi-value">{k.value}</p>
              </div>
            ))}
          </div>

          <section className="results-card releases-table-card">
            <div className="releases-table-head">
              <h3>{t("releasesHistoryTitle")}</h3>
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
                  ...releases.map((r) => [
                    String(r.version ?? ""),
                    String(r.created_at ?? ""),
                    String(r.promoted_at ?? ""),
                    String(r.promoted_by ?? ""),
                    String(r.n_included_variables ?? ""),
                    typeof r.manifest_path === "string" ? r.manifest_path : "",
                  ]),
                ]}
              />
            </div>
            {releases.length === 0 ? (
              <p className="muted" data-testid="releases-empty">
                {t("releasesEmpty")}
              </p>
            ) : (
              <div className="table-scroll" data-export-surface="table">
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
                      <tr key={String(r.version ?? r.manifest_path)}>
                        <td data-from-json="version">
                          <strong>{displayCell(r.version)}</strong>
                        </td>
                        <td data-from-json="created_at" className="font-tabular">
                          {formatWhen(r.created_at, lang)}
                        </td>
                        <td data-from-json="promoted_at" className="font-tabular">
                          {formatWhen(r.promoted_at, lang)}
                        </td>
                        <td data-from-json="promoted_by">
                          {displayCell(r.promoted_by)}
                        </td>
                        <td
                          data-from-json="n_included_variables"
                          className="font-tabular"
                        >
                          {formatInt(r.n_included_variables, lang)}
                        </td>
                        <td>
                          {typeof r.manifest_path === "string" ? (
                            <a href={r.manifest_path}>{r.manifest_path}</a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {publicRelease || internal ? (
            <section
              className="results-card releases-manifest"
              data-testid="manifest-summary"
            >
              <h3>{t("transparencyManifest")}</h3>
              <dl className="releases-dl">
                <div>
                  <dt>created_at</dt>
                  <dd data-from-json="manifest.created_at">
                    {formatWhen(publicRelease?.created_at, lang)}
                  </dd>
                </div>
                <div>
                  <dt>promoted_at</dt>
                  <dd data-from-json="manifest.promoted_at">
                    {formatWhen(publicRelease?.promoted_at, lang)}
                  </dd>
                </div>
                <div>
                  <dt>n_included_variables</dt>
                  <dd data-from-json="manifest.n_included_variables">
                    {formatInt(publicRelease?.n_included_variables, lang)}
                  </dd>
                </div>
                <div>
                  <dt>trade_rows</dt>
                  <dd data-from-json="manifest.trade_rows">
                    {formatInt(publicRelease?.row_counts?.trade_rows, lang)}
                  </dd>
                </div>
                <div>
                  <dt>{t("transparencySignature")}</dt>
                  <dd data-from-json="manifest.signature">
                    {displayCell(data?.signature?.status ?? "unsigned")}
                    {data?.signature?.note ? (
                      <span className="muted small">
                        {" "}
                        ({String(data.signature.note)})
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>{t("transparencySha256sums")}</dt>
                  <dd>
                    <a href={shaHref}>SHA256SUMS</a>
                  </dd>
                </div>
                {internal ? (
                  <div>
                    <dt>{t("releasesInternalVars")}</dt>
                    <dd data-from-json="internal.n_included_variables">
                      {formatInt(internal.n_included_variables, lang)}
                      {internal.manifest_path ? (
                        <>
                          {" · "}
                          <a href={String(internal.manifest_path)}>
                            {t("releasesInternalManifest")}
                          </a>
                        </>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}
        </div>
      )}
    </TransparencyShell>
  );
}
