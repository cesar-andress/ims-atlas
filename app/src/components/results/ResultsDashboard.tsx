import { useMemo, useState } from "react";
import {
  IMSFE_EOC_QUADRANTS,
  messageFor,
  orderKeysByWeight,
  type ImsfeEocQuadrant,
} from "@ims-atlas/core";
import { ExportMenu } from "../ExportMenu";
import { HelpButton } from "../HelpButton";
import {
  CRITERION_COLOR,
  CRITERION_LABEL,
  CRITERION_ORDER,
  isCriterionId,
  type CriterionId,
} from "../../design/criteria";
import {
  countryLabel,
  formatPctLocale,
  formatScoreLocale,
} from "../../design/formatLocale";
import { quadrantCopy } from "../../design/quadrantCopy";
import { rankingToCsv } from "../../cite/exportDownload";
import { useTranslation } from "../../i18n";
import { collectMethodWarnings } from "../../imsfe/collectMethodWarnings";
import { useImsfeEocMatrix } from "../../ranking/useImsfeEocMatrix";
import type { RankingViewModel } from "../../ranking/rankingEngine";
import { useAnalysis } from "../../state/useAnalysis";
import { useCompareSelection } from "../../state/useCompareSelection";

const PREVIEW = 12;

function quadrantCss(q: ImsfeEocQuadrant | null): {
  bg: string;
  fg: string;
  dot: string;
} {
  if (q === 1) return { bg: "var(--q1-bg)", fg: "var(--q1-fg)", dot: "var(--q1-dot)" };
  if (q === 2) return { bg: "var(--q2-bg)", fg: "var(--q2-fg)", dot: "var(--q2-dot)" };
  if (q === 3) return { bg: "var(--q3-bg)", fg: "var(--q3-fg)", dot: "var(--q3-dot)" };
  if (q === 4) return { bg: "var(--q4-bg)", fg: "var(--q4-fg)", dot: "var(--q4-dot)" };
  return {
    bg: "var(--q-missing-bg)",
    fg: "var(--q-missing-fg)",
    dot: "var(--q-missing-fg)",
  };
}

function criterionList(model: RankingViewModel, orderByWeight = false): CriterionId[] {
  const keys = Object.keys(model.weights.factors);
  if (orderByWeight) {
    return orderKeysByWeight(model.weights.factors, keys).filter(isCriterionId);
  }
  const ordered = CRITERION_ORDER.filter((c) => keys.includes(c));
  const rest = keys.filter(
    (k) => isCriterionId(k) && !ordered.includes(k),
  ) as CriterionId[];
  if (ordered.length + rest.length > 0) return [...ordered, ...rest];
  const fromScores = new Set<string>();
  for (const row of Object.values(model.factorScores)) {
    for (const k of Object.keys(row)) fromScores.add(k);
  }
  return CRITERION_ORDER.filter((c) => fromScores.has(c));
}

function contributions(
  model: RankingViewModel,
  iso3: string,
  criteria: CriterionId[],
): { id: CriterionId; weight: number; score: number; part: number }[] {
  return criteria.map((id) => {
    const weight = model.weights.factors[id] ?? 0;
    const score = model.factorScores[iso3]?.[id] ?? 0;
    return { id, weight, score, part: weight * score };
  });
}

type Props = { model: RankingViewModel };

/** GUI-0 read-only results dashboard (mockup layout). */
export function ResultsDashboard({ model }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config } = useAnalysis();
  const { compareA, selectIso } = useCompareSelection();
  const eoc = useImsfeEocMatrix(model);
  const methodWarnings = useMemo(() => collectMethodWarnings(config), [config]);
  const [showAll, setShowAll] = useState(false);

  const criteria = useMemo(
    () => criterionList(model, config.orderByWeight === true),
    [model, config.orderByWeight],
  );
  const qByIso = useMemo(() => {
    const m = new Map<string, ImsfeEocQuadrant>();
    for (const p of eoc?.points ?? []) m.set(p.iso3, p.quadrant);
    return m;
  }, [eoc]);
  const eocByIso = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of eoc?.points ?? []) m.set(p.iso3, p.eocNorm);
    return m;
  }, [eoc]);
  const missingEoc = useMemo(() => {
    if (!eoc) return model.ranking.map((r) => r.iso3);
    const have = new Set(eoc.points.map((p) => p.iso3));
    return model.ranking.map((r) => r.iso3).filter((iso) => !have.has(iso));
  }, [eoc, model.ranking]);

  const selectedIso =
    compareA && model.ranking.some((r) => r.iso3 === compareA)
      ? compareA
      : model.ranking[0]?.iso3;

  const top = model.ranking[0];
  const leaders = eoc ? eoc.points.filter((p) => p.quadrant === 1) : [];
  const topQ = top ? (qByIso.get(top.iso3) ?? null) : null;
  const topContrib = top ? contributions(model, top.iso3, criteria) : [];
  const topTwo = [...topContrib].sort((a, b) => b.part - a.part).slice(0, 2);

  const rows = showAll ? model.ranking : model.ranking.slice(0, PREVIEW);
  const selected = selectedIso
    ? model.ranking.find((r) => r.iso3 === selectedIso)
    : undefined;
  const selectedQ = selectedIso ? (qByIso.get(selectedIso) ?? null) : null;
  const selectedContrib = selectedIso
    ? contributions(model, selectedIso, criteria)
    : [];
  const best = selectedContrib.length
    ? selectedContrib.reduce((a, b) => (b.score > a.score ? b : a))
    : null;
  const worst = selectedContrib.length
    ? selectedContrib.reduce((a, b) => (b.score < a.score ? b : a))
    : null;
  const qCopy = selectedQ ? quadrantCopy(selectedQ, lang) : null;

  const illustrative = model.panel.illustrative || model.panel.synthetic;

  const summary =
    lang === "es"
      ? `Para HS${config.hs ?? "—"} desde ${config.origin ?? "—"} (${config.year ?? "—"}), los tres mejores mercados son ${model.ranking
          .slice(0, 3)
          .map(
            (r) =>
              `${countryLabel(r.iso3, lang)} (${formatScoreLocale(r.score, lang)})`,
          )
          .join(", ")}. ${
          top
            ? `El nº 1 destaca en ${topTwo
                .map((c) => CRITERION_LABEL[c.id][lang])
                .join(" y ")}.`
            : ""
        } Líderes globales: ${leaders.length} de ${model.ranking.length}.`
      : `For HS${config.hs ?? "—"} from ${config.origin ?? "—"} (${config.year ?? "—"}), the top three markets are ${model.ranking
          .slice(0, 3)
          .map(
            (r) =>
              `${countryLabel(r.iso3, lang)} (${formatScoreLocale(r.score, lang)})`,
          )
          .join(", ")}. ${
          top
            ? `#1 is strongest on ${topTwo
                .map((c) => CRITERION_LABEL[c.id][lang])
                .join(" and ")}.`
            : ""
        } Global leaders: ${leaders.length} of ${model.ranking.length}.`;

  const notice = illustrative
    ? t("illustrativeBanner")
    : model.warnings.length > 0
      ? model.warnings[0]
      : missingEoc.length > 0 && eoc
        ? lang === "es"
          ? `${missingEoc[0]} sin coeficiente de apertura (EOC); no se dibuja en la matriz.`
          : `${missingEoc[0]} has no openness (EOC) coefficient; not plotted.`
        : null;

  const scaleMax = 10;

  return (
    <div className="results-dash" data-testid="results-dashboard">
      {illustrative ? (
        <p
          className="results-illustrative-banner"
          data-testid="illustrative-banner"
          role="status"
        >
          {t("illustrativeBanner")}
        </p>
      ) : null}
      <header className="results-dash-header" data-testid="results-header">
        <div className="results-header-actions">
          <HelpButton />
          <ExportMenu
            testIdPrefix="results"
            kind="table"
            title={`Ranking ${config.origin ?? ""} HS${config.hs ?? ""}`}
            tableRows={rankingToCsv(model.ranking, model.factorScores)
              .trimEnd()
              .split("\n")
              .map((line) => line.split(","))}
            className="btn-export-wrap"
          />
        </div>
      </header>

      {notice && !illustrative ? (
        <p className="results-notice" data-testid="results-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="results-kpis" data-testid="results-kpis">
        <article className="results-card kpi">
          <h2>{lang === "es" ? "Mercado nº 1" : "Top market"}</h2>
          {top ? (
            <>
              <p className="kpi-title font-tabular">{countryLabel(top.iso3, lang)}</p>
              <p className="muted small">
                {formatScoreLocale(top.score, lang)} / {scaleMax}
                {topQ ? (
                  <>
                    {" · "}
                    <span
                      className="q-badge"
                      style={{
                        background: quadrantCss(topQ).bg,
                        color: quadrantCss(topQ).fg,
                      }}
                    >
                      {lang === "es"
                        ? IMSFE_EOC_QUADRANTS[topQ].es
                        : IMSFE_EOC_QUADRANTS[topQ].en}
                    </span>
                  </>
                ) : null}
              </p>
            </>
          ) : (
            <p>—</p>
          )}
        </article>
        <article className="results-card kpi">
          <h2>{lang === "es" ? "Líderes globales" : "Global leaders"}</h2>
          <p className="kpi-title font-tabular">
            {leaders.length} / {model.ranking.length}
          </p>
          <p className="muted small">
            {lang === "es"
              ? "IMSFE y apertura por encima de la mediana"
              : "IMSFE and openness above the median"}
          </p>
        </article>
        <article className="results-card kpi" data-testid="data-quality-card">
          <h2>{lang === "es" ? "Calidad de datos" : "Data quality"}</h2>
          <p className="kpi-title font-tabular">
            {model.warnings.length +
              methodWarnings.length +
              (missingEoc.length > 0 ? 1 : 0)}
          </p>
          <p className="muted small">
            {missingEoc.length > 0
              ? lang === "es"
                ? `${missingEoc[0]} sin coeficiente de apertura`
                : `${missingEoc[0]} missing openness coefficient`
              : methodWarnings[0]
                ? messageFor(methodWarnings[0], lang)
                : (model.warnings[0] ?? (lang === "es" ? "Sin avisos" : "No warnings"))}
          </p>
          {methodWarnings.length > 0 ? (
            <ul
              className="muted small mt-2 list-disc pl-4 text-left"
              data-testid="method-warnings-list"
            >
              {methodWarnings.slice(0, 5).map((w) => (
                <li key={w.code}>{messageFor(w, lang)}</li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>

      <article className="results-card results-summary" data-testid="results-summary">
        <p>{summary}</p>
      </article>

      <div className="results-two">
        <section className="results-card" data-testid="results-ranking-card">
          <h2>{lang === "es" ? "Ranking IMSFE" : "IMSFE ranking"}</h2>
          <ul className="crit-legend" data-testid="criterion-legend">
            {criteria.map((c) => (
              <li key={c}>
                <span className="swatch" style={{ background: CRITERION_COLOR[c] }} />
                {CRITERION_LABEL[c][lang]}{" "}
                <span className="font-tabular">
                  {formatPctLocale(model.weights.factors[c] ?? 0, lang)}
                </span>
              </li>
            ))}
          </ul>
          <div className="results-rank-scroll">
            <ul className="results-rank-list" data-testid="ranking-table" role="list">
              {rows.map((r) => {
                const parts = contributions(model, r.iso3, criteria);
                const q = qByIso.get(r.iso3) ?? null;
                const selected = r.iso3 === selectedIso;
                return (
                  <li key={r.iso3} data-iso3={r.iso3} data-rank={String(r.rank)}>
                    <button
                      type="button"
                      className={`rank-row${selected ? " selected" : ""}`}
                      data-testid={`rank-row-${r.iso3}`}
                      data-iso3={r.iso3}
                      data-rank={String(r.rank)}
                      aria-pressed={selected}
                      onClick={() => selectIso(r.iso3)}
                    >
                      <span className="rank-n font-tabular">{r.rank}</span>
                      <span className="iso-chip">{r.iso3}</span>
                      <span className="rank-name">{countryLabel(r.iso3, lang)}</span>
                      <span
                        className="stack-bar"
                        aria-hidden
                        title={formatScoreLocale(r.score, lang)}
                      >
                        <span
                          className="stack-inner"
                          style={{
                            width: `${Math.min(100, (r.score / scaleMax) * 100)}%`,
                          }}
                        >
                          {parts.map((p) => (
                            <span
                              key={p.id}
                              style={{
                                flex: Math.max(p.part, 0.0001),
                                background: CRITERION_COLOR[p.id],
                              }}
                            />
                          ))}
                        </span>
                      </span>
                      <span
                        className="rank-score font-tabular"
                        data-testid={`score-${r.iso3}`}
                        data-score={String(r.score)}
                      >
                        {formatScoreLocale(r.score, lang)}
                      </span>
                      {q ? (
                        <span
                          className="q-badge"
                          style={{
                            background: quadrantCss(q).bg,
                            color: quadrantCss(q).fg,
                          }}
                        >
                          {lang === "es"
                            ? IMSFE_EOC_QUADRANTS[q].es
                            : IMSFE_EOC_QUADRANTS[q].en}
                        </span>
                      ) : (
                        <span
                          className="q-badge"
                          style={{
                            background: quadrantCss(null).bg,
                            color: quadrantCss(null).fg,
                          }}
                        >
                          {lang === "es" ? "Sin EOC" : "No EOC"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="muted small results-footer-line">
            {lang === "es"
              ? `Mostrando ${rows.length} de ${model.ranking.length}`
              : `Showing ${rows.length} of ${model.ranking.length}`}
            {model.ranking.length > PREVIEW ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="linkish"
                  data-testid="results-show-all"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll
                    ? lang === "es"
                      ? "ver menos"
                      : "show less"
                    : lang === "es"
                      ? "ver todos"
                      : "show all"}
                </button>
              </>
            ) : null}
          </p>
        </section>

        <aside className="results-card" data-testid="results-why-card">
          <h2>{lang === "es" ? "Por qué este mercado" : "Why this market"}</h2>
          {selected ? (
            <>
              <p className="why-title">
                <span className="font-tabular">#{selected.rank}</span>{" "}
                <span className="iso-chip">{selected.iso3}</span>{" "}
                {countryLabel(selected.iso3, lang)}
                {selectedQ ? (
                  <>
                    {" "}
                    <span
                      className="q-badge"
                      style={{
                        background: quadrantCss(selectedQ).bg,
                        color: quadrantCss(selectedQ).fg,
                      }}
                    >
                      {lang === "es"
                        ? IMSFE_EOC_QUADRANTS[selectedQ].es
                        : IMSFE_EOC_QUADRANTS[selectedQ].en}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="muted small font-tabular">
                IMSFE {formatScoreLocale(selected.score, lang)}
                {eocByIso.has(selected.iso3)
                  ? ` · ${lang === "es" ? "Apertura" : "Openness"} ${formatScoreLocale(eocByIso.get(selected.iso3)!, lang)}`
                  : ""}
              </p>
              <ul className="why-bars">
                {selectedContrib.map((c) => (
                  <li key={c.id}>
                    <span>{CRITERION_LABEL[c.id][lang]}</span>
                    <span className="thin-bar">
                      <span
                        style={{
                          width: `${Math.min(100, (c.score / scaleMax) * 100)}%`,
                          background: CRITERION_COLOR[c.id],
                        }}
                      />
                    </span>
                    <span className="font-tabular">
                      {formatScoreLocale(c.score, lang)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="why-tiles">
                {best ? (
                  <div className="tile strong">
                    <strong>{lang === "es" ? "Punto fuerte" : "Strength"}</strong>
                    <p>{CRITERION_LABEL[best.id][lang]}</p>
                  </div>
                ) : null}
                {worst ? (
                  <div className="tile weak">
                    <strong>{lang === "es" ? "Punto débil" : "Weakness"}</strong>
                    <p>{CRITERION_LABEL[worst.id][lang]}</p>
                  </div>
                ) : null}
              </div>
              {selectedQ && qCopy ? (
                <div className="why-strategy" data-testid="results-strategy">
                  <h3>
                    {lang === "es" ? "Estrategia recomendada" : "Recommended strategy"}{" "}
                    ·{" "}
                    {lang === "es"
                      ? IMSFE_EOC_QUADRANTS[selectedQ].es
                      : IMSFE_EOC_QUADRANTS[selectedQ].en}
                  </h3>
                  <p className="small">{qCopy.strategy}</p>
                  <p className="muted small">{t("matrixAuthorsNote")}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">
              {lang === "es" ? "Selecciona un mercado" : "Select a market"}
            </p>
          )}
        </aside>
      </div>

      <div className="results-two">
        <section className="results-card" data-testid="results-matrix-card">
          <h2>
            {lang === "es"
              ? "Matriz IMSFE × apertura comercial"
              : "IMSFE × commercial openness matrix"}
          </h2>
          {eoc ? (
            <>
              <p className="muted small">
                {lang === "es"
                  ? `Cortes en la mediana: IMSFE ${formatScoreLocale(eoc.cutImsfe, lang)} · EOC ${formatScoreLocale(eoc.cutEoc, lang)}`
                  : `Median cuts: IMSFE ${formatScoreLocale(eoc.cutImsfe, lang)} · EOC ${formatScoreLocale(eoc.cutEoc, lang)}`}
              </p>
              <div className="eoc-plot" data-testid="results-eoc-plot">
                {([4, 1, 3, 2] as const).map((q) => {
                  const n = eoc.points.filter((p) => p.quadrant === q).length;
                  const label =
                    lang === "es"
                      ? IMSFE_EOC_QUADRANTS[q].es.toUpperCase()
                      : IMSFE_EOC_QUADRANTS[q].en;
                  return (
                    <div
                      key={q}
                      className={`eoc-quad q${q}`}
                      data-testid={`eoc-quad-${q}`}
                    >
                      <span className="eoc-quad-label">
                        {label} ({n})
                      </span>
                    </div>
                  );
                })}
                <svg
                  viewBox="0 0 100 100"
                  className="eoc-dots"
                  role="img"
                  aria-label="IMSFE vs EOC"
                >
                  <line
                    x1={eoc.cutEoc * 10}
                    y1={0}
                    x2={eoc.cutEoc * 10}
                    y2={100}
                    className="cut"
                  />
                  <line
                    x1={0}
                    y1={100 - eoc.cutImsfe * 10}
                    x2={100}
                    y2={100 - eoc.cutImsfe * 10}
                    className="cut"
                  />
                  {eoc.points.map((p) => {
                    const cx = Math.min(98, Math.max(2, p.eocNorm * 10));
                    const cy = Math.min(98, Math.max(2, 100 - p.imsfe * 10));
                    const sel = p.iso3 === selectedIso;
                    return (
                      <g key={p.iso3}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={sel ? 2.8 : 1.6}
                          fill={quadrantCss(p.quadrant).dot}
                          stroke={sel ? "var(--ink)" : "none"}
                          strokeWidth={sel ? 0.6 : 0}
                          className="eoc-dot"
                          data-iso3={p.iso3}
                          onClick={() => selectIso(p.iso3)}
                          style={{ cursor: "pointer" }}
                        />
                        <text
                          x={cx + 2}
                          y={cy - 1.5}
                          className="eoc-label"
                          onClick={() => selectIso(p.iso3)}
                        >
                          {p.iso3}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              {missingEoc.length > 0 ? (
                <p className="muted small" data-testid="results-missing-eoc">
                  {lang === "es"
                    ? "Sin EOC (no dibujados): "
                    : "No EOC (not plotted): "}
                  {missingEoc.join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="muted" data-testid="results-eoc-pending">
              {t("matrixEocPending")}
            </p>
          )}
        </section>

        <section className="results-card" data-testid="results-next-steps">
          <h2>{lang === "es" ? "Siguientes pasos" : "Next steps"}</h2>
          <p className="small">
            {lang === "es"
              ? "El ranking ordena mercados; no sustituye el análisis cualitativo que recomiendan los autores."
              : "The ranking orders markets; it does not replace the qualitative analysis the authors recommend."}
          </p>
          <ol>
            <li>
              {lang === "es"
                ? "Revisar reglas de origen y medidas no arancelarias (p. ej. ITC Market Access Map)."
                : "Check rules of origin and non-tariff measures (e.g. ITC Market Access Map)."}
            </li>
            <li>
              {lang === "es"
                ? "Contrastar con inteligencia comercial local (p. ej. ProColombia u oficina de promoción)."
                : "Cross-check with local trade-promotion intelligence (e.g. ProColombia)."}
            </li>
            <li>
              {lang === "es"
                ? "Validar logistica, canal y partner antes de comprometer inversión."
                : "Validate logistics, channel and partner before committing investment."}
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
