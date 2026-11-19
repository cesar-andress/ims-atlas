import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { HelpButton } from "../components/HelpButton";
import { loadT4Fixture, type T4Fixture } from "../data/loadT4Fixture";
import { formatScore } from "../format";
import { useTranslation } from "../i18n";
import { COL_HS64_PRESET } from "../state/schema";

/** Reviewer page: paper T4 tables from the shipped fixture + permalinks. */
export function PaperSupport() {
  const { t } = useTranslation();
  const [fixture, setFixture] = useState<T4Fixture | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadT4Fixture()
      .then((f) => {
        if (!cancelled) setFixture(f);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ndcgRows = useMemo(() => {
    if (!fixture) return [];
    return fixture.metrics.filter(
      (m) => m.metric === "ndcg@10" && m.target === "intensive" && m.horizon === 1,
    );
  }, [fixture]);

  return (
    <PageShell
      testId="paper-view"
      titleKey="nav.paper"
      className="paper-page"
      intro={t("paperIntro")}
    >
      <div className="page-help-row">
        <HelpButton section="researchers" />
      </div>
      <p className="muted small" data-testid="paper-provenance">
        {fixture?.provenance ?? t("loading")}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <section data-testid="paper-t4-section">
        <h2>{t("paperT4Title")}</h2>
        <p className="small">
          <PermalinkLink
            view="backtest"
            replace={{ ...COL_HS64_PRESET, view: "backtest" }}
            data-testid="paper-link-backtest"
          >
            {t("nav.backtest")}
          </PermalinkLink>
          {" · "}
          <PermalinkLink
            view="uncertainty"
            replace={{ ...COL_HS64_PRESET, view: "uncertainty" }}
          >
            {t("nav.uncertainty")}
          </PermalinkLink>
          {" · "}
          <PermalinkLink view="time" replace={{ ...COL_HS64_PRESET, view: "time" }}>
            {t("nav.time")}
          </PermalinkLink>
          {" · "}
          <PermalinkLink
            view="ranking"
            replace={{ ...COL_HS64_PRESET, view: "ranking" }}
          >
            {t("nav.ranking")}
          </PermalinkLink>
        </p>
        <div className="table-scroll">
          <table data-testid="paper-t4-ndcg">
            <thead>
              <tr>
                <th>{t("paperMethod")}</th>
                <th>NDCG@10</th>
                <th>CI95 low</th>
                <th>CI95 high</th>
                <th>n</th>
              </tr>
            </thead>
            <tbody>
              {ndcgRows.map((r) => (
                <tr key={r.method} data-method={r.method}>
                  <td>
                    <code>{r.method}</code>
                  </td>
                  <td data-from-json="mean">{formatScore(r.mean)}</td>
                  <td>{formatScore(r.ci95_low)}</td>
                  <td>{formatScore(r.ci95_high)}</td>
                  <td>{r.n_blocks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">{t("paperT4Note")}</p>
      </section>
    </PageShell>
  );
}
