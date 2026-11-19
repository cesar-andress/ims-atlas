import { PageShell } from "../components/PageShell";
import { EmptyState } from "../components/ui/EmptyState";
import { CRITERION_COLOR, CRITERION_LABEL, CRITERION_ORDER } from "../design/criteria";
import { PermalinkLink } from "../components/PermalinkLink";
import { useTranslation } from "../i18n";

const ILLUSTRATIVE = {
  top: "Chequia",
  score: "5,87",
  markets: 60,
  coverage: "92 %",
};

/** Static design review page — labelled illustrative values only. */
export function DesignSystem() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  return (
    <PageShell
      testId="design-system-view"
      titleKey="nav.design"
      className="design-system"
    >
      <p className="note" data-testid="design-illustrative-banner">
        {t("designIllustrative")}
      </p>

      <section className="mb-8" data-testid="design-tokens">
        <h2 className="text-lg font-semibold text-ink">{t("designTokens")}</h2>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {(
            [
              ["ground", "var(--ground)"],
              ["surface", "var(--surface)"],
              ["border", "var(--border)"],
              ["ink", "var(--ink)"],
              ["primary", "var(--primary)"],
            ] as const
          ).map(([name, css]) => (
            <div
              key={name}
              className="rounded-card border border-border bg-surface p-3 text-sm"
            >
              <div
                className="mb-2 h-10 rounded-btn border border-border"
                style={{ background: css }}
              />
              <code>{name}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8" data-testid="design-criteria">
        <h2 className="text-lg font-semibold text-ink">{t("designCriteria")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CRITERION_ORDER.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-2 rounded-chip border border-border px-3 py-1 text-sm"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: CRITERION_COLOR[id] }}
                aria-hidden
              />
              {CRITERION_LABEL[id][lang]} · {id}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-8" data-testid="design-kpis">
        <h2 className="text-lg font-semibold text-ink">KPI cards</h2>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
            <p className="m-0 text-xs uppercase tracking-wide text-ink-3">
              Mercado nº 1 (ilustrativo)
            </p>
            <p className="m-0 mt-1 text-xl font-semibold text-ink font-tabular">
              {ILLUSTRATIVE.top} · {ILLUSTRATIVE.score}/10
            </p>
          </div>
          <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
            <p className="m-0 text-xs uppercase tracking-wide text-ink-3">
              Mercados analizados
            </p>
            <p className="m-0 mt-1 text-xl font-semibold text-ink font-tabular">
              {ILLUSTRATIVE.markets}
            </p>
          </div>
          <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
            <p className="m-0 text-xs uppercase tracking-wide text-ink-3">
              Cobertura de datos
            </p>
            <p className="m-0 mt-1 text-xl font-semibold text-ink font-tabular">
              {ILLUSTRATIVE.coverage}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8" data-testid="design-lineup">
        <h2 className="text-lg font-semibold text-ink">
          LineUp-style bar (ilustrativo)
        </h2>
        <div className="mt-3 rounded-card border border-border bg-surface p-4">
          <div className="mb-1 flex justify-between text-sm">
            <span>1 · CZE · Chequia</span>
            <span className="font-tabular">5,87</span>
          </div>
          <div className="flex h-4 w-full max-w-xl overflow-hidden rounded-btn">
            {CRITERION_ORDER.map((id) => (
              <div
                key={id}
                style={{ flex: 1, background: CRITERION_COLOR[id] }}
                title={CRITERION_LABEL[id][lang]}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8" data-testid="design-empty">
        <h2 className="text-lg font-semibold text-ink">Empty state</h2>
        <div className="mt-3">
          <EmptyState
            title={t("designEmptyTitle")}
            body={t("designEmptyBody")}
            action={
              <PermalinkLink view="builder" className="btn btn-primary">
                {t("changeAnalysis")}
              </PermalinkLink>
            }
          />
        </div>
      </section>

      <p className="muted small">
        Fuentes: <code>docs/design.md</code> (LineUp, WeightLifter, ValueCharts, Podium,
        Kay CHI 2016, Hullman HOPs, Shneiderman 1996, Nielsen 1994).
      </p>
    </PageShell>
  );
}
