import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { ExportMenu } from "../components/ExportMenu";
import { VariableBasket } from "../components/VariableBasket";
import { addToBasket } from "../state/variableBasket";
import { loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogVariable } from "../data/types";
import { useTranslation } from "../i18n";
import { LATEST_COMPLETE_YEAR } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";
import { PermalinkLink } from "../components/PermalinkLink";

type FlatCell = {
  variableId: string;
  factor: string;
  source: string;
  redistributable: boolean;
  iso3: string;
  year: number;
  value: number | null;
};

function flattenCatalog(vars: CatalogVariable[]): FlatCell[] {
  const out: FlatCell[] = [];
  for (const v of vars) {
    const demo = v.coverage_demo;
    if (!demo) continue;
    for (const [iso3, byYear] of Object.entries(demo)) {
      for (const [yearStr, value] of Object.entries(byYear)) {
        out.push({
          variableId: v.id,
          factor: v.factor,
          source: v.source_ids[0] ?? "",
          redistributable: Boolean(v.redistributable),
          iso3,
          year: Number(yearStr),
          value: value === null || value === undefined ? null : Number(value),
        });
      }
    }
  }
  return out;
}

/** Phase E /explore — variable × country × year (catalog demo / release). */
export function Explore() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const [vars, setVars] = useState<CatalogVariable[]>([]);
  const [factor, setFactor] = useState(config.exploreFactor ?? "");
  const [source, setSource] = useState(config.exploreSource ?? "");
  const [licence, setLicence] = useState<"all" | "open" | "closed">(
    config.exploreLicence ?? "all",
  );
  const [yearFrom, setYearFrom] = useState(config.exploreYearFrom ?? 2015);
  const [yearTo, setYearTo] = useState(
    config.exploreYearTo ?? config.year ?? LATEST_COMPLETE_YEAR,
  );
  const [minCov, setMinCov] = useState(config.exploreMinCoverage ?? 0);
  const [pin, setPin] = useState<string[]>(config.explorePinned ?? []);
  const [sortKey, setSortKey] = useState<"variableId" | "iso3" | "year">("variableId");
  const [visibleCols, setVisibleCols] = useState({
    factor: true,
    source: true,
    licence: true,
  });
  const [windowStart, setWindowStart] = useState(0);
  const PAGE = 80;

  useEffect(() => {
    void loadCatalogPreview().then((c) => setVars(c.variables));
  }, []);

  const flat = useMemo(() => flattenCatalog(vars), [vars]);

  const factors = useMemo(() => [...new Set(vars.map((v) => v.factor))].sort(), [vars]);
  const sources = useMemo(
    () => [...new Set(vars.flatMap((v) => v.source_ids))].sort(),
    [vars],
  );

  const filtered = useMemo(() => {
    let rows = flat.filter((r) => r.year >= yearFrom && r.year <= yearTo);
    if (factor) rows = rows.filter((r) => r.factor === factor);
    if (source) rows = rows.filter((r) => r.source === source);
    if (licence === "open") rows = rows.filter((r) => r.redistributable);
    if (licence === "closed") rows = rows.filter((r) => !r.redistributable);
    if (pin.length) {
      const pinned = rows.filter((r) => pin.includes(r.iso3));
      const rest = rows.filter((r) => !pin.includes(r.iso3));
      rows = [...pinned, ...rest];
    }
    if (minCov > 0) {
      const byVar = new Map<string, { n: number; ok: number }>();
      for (const r of rows) {
        const s = byVar.get(r.variableId) ?? { n: 0, ok: 0 };
        s.n += 1;
        if (r.value !== null && Number.isFinite(r.value)) s.ok += 1;
        byVar.set(r.variableId, s);
      }
      const keep = new Set(
        [...byVar.entries()]
          .filter(([, s]) => s.n > 0 && s.ok / s.n >= minCov)
          .map(([id]) => id),
      );
      rows = rows.filter((r) => keep.has(r.variableId));
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return rows;
  }, [flat, factor, source, licence, yearFrom, yearTo, pin, minCov, sortKey]);

  const slice = filtered.slice(windowStart, windowStart + PAGE);

  function syncFilters(patch: Parameters<typeof setConfig>[0]) {
    setConfig(patch);
  }

  function togglePin(iso: string) {
    const next = pin.includes(iso)
      ? pin.filter((x) => x !== iso)
      : [...pin, iso].slice(0, 24);
    setPin(next);
    syncFilters({ explorePinned: next });
  }

  return (
    <PageShell testId="explore-view" titleKey="nav.explore" className="explore-page">
      <p className="muted">{t("exploreIntro")}</p>
      <VariableBasket compact />

      <div className="explore-filters" data-testid="explore-filters">
        <label>
          {t("transparencyFactor")}
          <select
            data-testid="explore-factor"
            value={factor}
            onChange={(e) => {
              const v = e.target.value;
              setFactor(v);
              if (v) syncFilters({ exploreFactor: v });
            }}
          >
            <option value="">{t("exploreAll")}</option>
            {factors.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("transparencySources")}
          <select
            data-testid="explore-source"
            value={source}
            onChange={(e) => {
              const v = e.target.value;
              setSource(v);
              if (v) syncFilters({ exploreSource: v });
            }}
          >
            <option value="">{t("exploreAll")}</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("exploreLicence")}
          <select
            data-testid="explore-licence"
            value={licence}
            onChange={(e) => {
              const v = e.target.value as "all" | "open" | "closed";
              setLicence(v);
              syncFilters({ exploreLicence: v });
            }}
          >
            <option value="all">{t("exploreAll")}</option>
            <option value="open">{t("exploreOpen")}</option>
            <option value="closed">{t("exploreClosed")}</option>
          </select>
        </label>
        <label>
          {t("exploreYearFrom")}
          <input
            type="number"
            data-testid="explore-year-from"
            value={yearFrom}
            onChange={(e) => {
              const n = Number(e.target.value);
              setYearFrom(n);
              syncFilters({ exploreYearFrom: n });
            }}
          />
        </label>
        <label>
          {t("exploreYearTo")}
          <input
            type="number"
            data-testid="explore-year-to"
            value={yearTo}
            onChange={(e) => {
              const n = Number(e.target.value);
              setYearTo(n);
              syncFilters({ exploreYearTo: n });
            }}
          />
        </label>
        <label>
          {t("exploreMinCoverage")}
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            data-testid="explore-min-cov"
            value={minCov}
            onChange={(e) => {
              const n = Number(e.target.value);
              setMinCov(n);
              syncFilters({ exploreMinCoverage: n });
            }}
          />
        </label>
        <label className="explore-cols">
          <input
            type="checkbox"
            checked={visibleCols.factor}
            onChange={(e) =>
              setVisibleCols((c) => ({ ...c, factor: e.target.checked }))
            }
          />{" "}
          factor
        </label>
        <label className="explore-cols">
          <input
            type="checkbox"
            checked={visibleCols.source}
            onChange={(e) =>
              setVisibleCols((c) => ({ ...c, source: e.target.checked }))
            }
          />{" "}
          source
        </label>
      </div>

      <p className="small muted" data-testid="explore-count">
        {t("exploreRows").replace("{n}", String(filtered.length))}
        {filtered.length === 0 ? ` — ${t("exploreEmptyRelease")}` : ""}
      </p>

      <div className="explore-table-wrap" data-export-surface="table">
        <ExportMenu
          testIdPrefix="explore"
          kind="table"
          title="Explore table"
          tableRows={[
            ["variable_id", "factor", "source", "iso3", "year", "value"],
            ...filtered.map((r) => [
              r.variableId,
              r.factor,
              r.source,
              r.iso3,
              String(r.year),
              r.value === null ? "" : String(r.value),
            ]),
          ]}
        />
        <table data-testid="explore-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => setSortKey("variableId")}>
                  {t("variables")}
                </button>
              </th>
              {visibleCols.factor ? <th>factor</th> : null}
              {visibleCols.source ? <th>source</th> : null}
              <th>
                <button type="button" onClick={() => setSortKey("iso3")}>
                  ISO3
                </button>
              </th>
              <th>
                <button type="button" onClick={() => setSortKey("year")}>
                  {t("year")}
                </button>
              </th>
              <th>{t("parityRaw")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={`${r.variableId}-${r.iso3}-${r.year}`}>
                <td>
                  <PermalinkLink
                    view="data_variable"
                    patch={{ focusVariable: r.variableId }}
                  >
                    {r.variableId}
                  </PermalinkLink>
                </td>
                {visibleCols.factor ? <td>{r.factor}</td> : null}
                {visibleCols.source ? <td>{r.source}</td> : null}
                <td>
                  <button
                    type="button"
                    className={pin.includes(r.iso3) ? "pinned" : undefined}
                    data-testid={`explore-pin-${r.iso3}`}
                    onClick={() => togglePin(r.iso3)}
                  >
                    {r.iso3}
                    {pin.includes(r.iso3) ? " ★" : ""}
                  </button>
                </td>
                <td>{r.year}</td>
                <td data-testid="explore-value">
                  {r.value === null || !Number.isFinite(r.value)
                    ? t("exploreMissing")
                    : r.value}
                </td>
                <td>
                  <button
                    type="button"
                    data-testid={`explore-add-${r.variableId}`}
                    onClick={() =>
                      setConfig({
                        variableIds: addToBasket(config.variableIds, r.variableId),
                      })
                    }
                  >
                    {t("basketAdd")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="explore-pager">
        <button
          type="button"
          disabled={windowStart <= 0}
          onClick={() => setWindowStart((s) => Math.max(0, s - PAGE))}
        >
          {t("explorePrev")}
        </button>
        <span className="small muted">
          {windowStart + 1}–{Math.min(filtered.length, windowStart + PAGE)}
        </span>
        <button
          type="button"
          disabled={windowStart + PAGE >= filtered.length}
          onClick={() => setWindowStart((s) => s + PAGE)}
        >
          {t("exploreNext")}
        </button>
        <PermalinkLink view="explore_analysis">
          {t("nav.explore_analysis")}
        </PermalinkLink>
        <PermalinkLink view="sql">{t("nav.sql")}</PermalinkLink>
      </div>
    </PageShell>
  );
}
