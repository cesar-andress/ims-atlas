import { useMemo, useState } from "react";
import { AccessBadge } from "../../components/AccessBadge";
import { CopyUrlButton } from "../../components/CopyUrlButton";
import { ExportMenu } from "../../components/ExportMenu";
import { FixtureStatusBanner } from "../../components/FixtureStatusBanner";
import { TransparencyShell } from "../../components/TransparencyShell";
import { resolveSourceStore } from "../../auth/accessStore";
import {
  loadSources,
  loadSourcesState,
  type SourcesStatePayload,
  type SourcesStateRow,
  type TransparencySource,
} from "../../data/transparency";
import { displayCell } from "../../formatDisplay";
import { useTranslation } from "../../i18n";
import { useAsyncResource } from "../../state/useAsyncResource";

type FilterId = "all" | "open" | "closed" | "stale" | "ok";

function formatWhen(value: unknown, lang: "es" | "en"): string {
  if (typeof value !== "string" || !value.trim()) return "—";
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

function sourceHaystack(s: TransparencySource): string {
  const rights = s.rights ?? {};
  const fr = s.freshness ?? {};
  return [
    s.id,
    s.publisher,
    s.update_cadence,
    rights.licence_id,
    fr.ingested_version,
    s.release_version,
    s.landing_url,
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
}

export function DataSources() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { data, error, loading } = useAsyncResource(() => loadSources(), []);
  const stateRes = useAsyncResource(
    () => loadSourcesState().catch((): SourcesStatePayload => ({ sources: {} })),
    [],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  const rows = useMemo(() => {
    if (!data) return [];
    const stateById = stateRes.data?.sources ?? {};
    return data.sources.map((s) => {
      const store = resolveSourceStore(s.store ?? null, s.rights ?? null);
      const fr = s.freshness ?? {};
      const stale = fr.stale === true;
      const st = stateById[s.id] as SourcesStateRow | undefined;
      const liveOk = st?.status === "ok" && (st.rows ?? 0) > 0;
      return { source: s, store, stale, liveOk, state: st };
    });
  }, [data, stateRes.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ source, store, stale, liveOk }) => {
      if (filter === "open" && store !== "abierta") return false;
      if (filter === "closed" && store !== "cerrada") return false;
      if (filter === "stale" && !stale) return false;
      if (filter === "ok" && !liveOk) return false;
      if (q && !sourceHaystack(source).includes(q)) return false;
      return true;
    });
  }, [rows, query, filter]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.store === "abierta").length;
    const closed = rows.length - open;
    const stale = rows.filter((r) => r.stale).length;
    const ok = rows.filter((r) => r.liveOk).length;
    return { total: rows.length, open, closed, stale, ok };
  }, [rows]);

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
        <div className="sources-pro">
          <FixtureStatusBanner
            isFixture={Boolean(data.is_fixture)}
            message={data.fixture_banner ?? null}
          />

          <div className="sources-kpi-grid">
            <article className="sources-kpi">
              <p className="sources-kpi-label">{t("sourcesStatTotal")}</p>
              <p className="sources-kpi-value font-tabular">{stats.total}</p>
            </article>
            <article className="sources-kpi">
              <p className="sources-kpi-label">{t("sourcesStatOpen")}</p>
              <p className="sources-kpi-value font-tabular">{stats.open}</p>
            </article>
            <article className="sources-kpi">
              <p className="sources-kpi-label">{t("sourcesStatClosed")}</p>
              <p className="sources-kpi-value font-tabular">{stats.closed}</p>
            </article>
            <article className="sources-kpi">
              <p className="sources-kpi-label">{t("sourcesStatLiveOk")}</p>
              <p className="sources-kpi-value font-tabular">
                {stats.ok}
                <span className="sources-kpi-den muted">/{stats.total}</span>
              </p>
            </article>
            <article className="sources-kpi">
              <p className="sources-kpi-label">{t("sourcesStatStale")}</p>
              <p className="sources-kpi-value font-tabular">{stats.stale}</p>
            </article>
          </div>

          <div className="sources-controls results-card">
            <label className="sources-filter-search">
              <span className="visually-hidden">{t("sourcesFilterSearch")}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("sourcesFilterSearch")}
                data-testid="sources-filter-q"
              />
            </label>
            <div
              className="sources-filter-chips"
              role="group"
              aria-label={t("sourcesFilterLabel")}
            >
              {(
                [
                  ["all", t("sourcesFilterAll")],
                  ["open", t("sourcesFilterOpen")],
                  ["closed", t("sourcesFilterClosed")],
                  ["ok", t("sourcesFilterOk")],
                  ["stale", t("sourcesFilterStale")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`sources-chip${filter === id ? " is-active" : ""}`}
                  data-testid={`sources-filter-${id}`}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="sources-showing muted small">
              {t("sourcesShowing")
                .replace("{n}", String(filtered.length))
                .replace("{total}", String(stats.total))}
            </p>
          </div>

          <section className="results-card sources-panel" data-export-surface="table">
            <div className="sources-panel-head">
              <div>
                <h2>{t("sourcesRegistryTitle")}</h2>
                <p className="muted small">{t("transparencySourcesIntro")}</p>
              </div>
              <ExportMenu
                testIdPrefix="sources"
                kind="table"
                title="Data sources"
                tableRows={[
                  [
                    "id",
                    "store",
                    "publisher",
                    "licence_id",
                    "cadence",
                    "checked_at",
                    "release_version",
                    "tier",
                    "rows",
                    "status",
                  ],
                  ...filtered.map(({ source: s, store, state }) => {
                    const fr = s.freshness ?? {};
                    const rights = s.rights ?? {};
                    return [
                      s.id,
                      store,
                      String(s.publisher ?? ""),
                      String(rights.licence_id ?? ""),
                      String(s.update_cadence ?? ""),
                      String(fr.checked_at ?? ""),
                      String(s.release_version ?? ""),
                      String(state?.tier ?? ""),
                      String(state?.rows ?? ""),
                      String(state?.status ?? ""),
                    ];
                  }),
                ]}
              />
            </div>

            <div className="sources-table-wrap">
              <table className="sources-table" data-testid="sources-table">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">{t("transparencyAccess")}</th>
                    <th scope="col">{t("sourcesColStatus")}</th>
                    <th scope="col">{t("transparencyPublisher")}</th>
                    <th scope="col">{t("transparencyLicence")}</th>
                    <th scope="col">{t("transparencyCadence")}</th>
                    <th scope="col">{t("transparencyLastChecked")}</th>
                    <th scope="col">{t("transparencyUpstreamChange")}</th>
                    <th scope="col">{t("transparencyIngested")}</th>
                    <th scope="col">{t("transparencyReleaseVersion")}</th>
                    <th scope="col">{t("transparencyStale")}</th>
                    <th scope="col">{t("sourcesColRows")}</th>
                    <th scope="col">{t("transparencyRightsCheckedBy")}</th>
                    <th scope="col">{t("transparencyRightsCheckedOn")}</th>
                    <th scope="col">{t("transparencyTermsHash")}</th>
                    <th scope="col">{t("transparencyTermsChanged")}</th>
                    <th scope="col">{t("transparencyLinks")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ source: s, stale, liveOk, state }) => {
                    const fr = s.freshness ?? {};
                    const rights = s.rights ?? {};
                    const evidence =
                      (rights.evidence as Record<string, unknown> | undefined) ?? {};
                    const statusLabel = liveOk
                      ? t("sourcesStatusOk")
                      : state?.status === "pending_file"
                        ? t("sourcesStatusPendingFile")
                        : state?.status === "fail"
                          ? t("sourcesStatusFail")
                          : stale
                            ? t("sourcesStatusStale")
                            : t("sourcesStatusUnknown");
                    const statusClass = liveOk
                      ? "ok"
                      : state?.status === "fail"
                        ? "fail"
                        : stale
                          ? "stale"
                          : "muted";
                    return (
                      <tr key={s.id} data-source-id={s.id}>
                        <th scope="row" data-from-json="id">
                          <code className="sources-id">{s.id}</code>
                          {state?.tier ? (
                            <span className="sources-tier">Tier {state.tier}</span>
                          ) : null}
                        </th>
                        <td>
                          <AccessBadge
                            kind="source"
                            store={s.store ?? null}
                            rights={rights}
                          />
                        </td>
                        <td>
                          <span
                            className={`sources-status sources-status-${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td data-from-json="publisher">{displayCell(s.publisher)}</td>
                        <td data-from-json="licence_id">
                          <span className="sources-licence">
                            {displayCell(rights.licence_id)}
                          </span>
                        </td>
                        <td data-from-json="update_cadence">
                          {displayCell(s.update_cadence)}
                        </td>
                        <td data-from-json="checked_at" className="font-tabular">
                          {formatWhen(fr.checked_at ?? state?.checked_at, lang)}
                        </td>
                        <td
                          data-from-json="upstream_changed_at"
                          className="font-tabular"
                        >
                          {formatWhen(fr.upstream_changed_at, lang)}
                        </td>
                        <td data-from-json="ingested_version">
                          {displayCell(fr.ingested_version ?? state?.version)}
                        </td>
                        <td data-from-json="release_version">
                          {displayCell(s.release_version)}
                        </td>
                        <td data-from-json="stale">
                          {stale ? (
                            <span className="sources-stale-yes">{t("sourcesYes")}</span>
                          ) : (
                            displayCell(fr.stale)
                          )}
                        </td>
                        <td className="font-tabular">
                          {typeof state?.rows === "number"
                            ? state.rows.toLocaleString(
                                lang === "es" ? "es-ES" : "en-GB",
                              )
                            : "—"}
                        </td>
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
                          {displayCell(
                            (fr as { terms_changed?: unknown }).terms_changed,
                          )}
                        </td>
                        <td className="sources-links">
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
          </section>

          <section
            className="results-card sources-endpoints"
            data-testid="sources-endpoints"
          >
            <h2>{t("transparencyEndpoints")}</h2>
            <p className="muted small">{t("sourcesEndpointsHint")}</p>
            <ul className="sources-endpoint-list">
              {data.sources.flatMap((s) =>
                (s.endpoints ?? [])
                  .filter((ep) => ep.template)
                  .map((ep) => (
                    <li key={`${s.id}-${ep.id ?? ep.template}`}>
                      <span className="sources-endpoint-id">
                        <strong>{s.id}</strong>
                        {ep.id ? ` / ${ep.id}` : ""}
                      </span>
                      <CopyUrlButton url={String(ep.template)} />
                    </li>
                  )),
              )}
            </ul>
          </section>
        </div>
      )}
    </TransparencyShell>
  );
}
