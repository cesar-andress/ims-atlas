import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { loadCatalogPreview } from "../data/catalogLoader";
import { ISO3_EXPORTERS } from "../data/iso3Exporters";
import type { CatalogVariable } from "../data/types";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

function percentile(value: number, peers: number[]): number | null {
  if (!peers.length || !Number.isFinite(value)) return null;
  const sorted = [...peers].sort((a, b) => a - b);
  let below = 0;
  for (const p of sorted) if (p < value) below += 1;
  return below / sorted.length;
}

/** Phase E country profile. */
export function CountryProfile() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const iso = (config.focusCountry ?? config.compareA ?? "COL").toUpperCase();
  const [vars, setVars] = useState<CatalogVariable[]>([]);
  const year = config.year ?? 2023;

  useEffect(() => {
    void loadCatalogPreview().then((c) => setVars(c.variables));
  }, []);

  const rows = useMemo(() => {
    return vars.map((v) => {
      const demo = v.coverage_demo;
      const own = demo?.[iso]?.[String(year)] ?? null;
      const peerVals: number[] = [];
      if (demo) {
        for (const byYear of Object.values(demo)) {
          const x = byYear[String(year)];
          if (x !== null && x !== undefined && Number.isFinite(x)) peerVals.push(x);
        }
      }
      const pct =
        own !== null && Number.isFinite(own)
          ? percentile(own as number, peerVals)
          : null;
      return {
        id: v.id,
        factor: v.factor,
        value: own,
        percentile: pct,
        nPeers: peerVals.length,
      };
    });
  }, [vars, iso, year]);

  return (
    <PageShell testId="country-view" titleKey="nav.country" className="country-page">
      <p className="muted">{t("countryIntro")}</p>
      <label>
        ISO3{" "}
        <select
          data-testid="country-iso"
          value={iso}
          onChange={(e) => setConfig({ focusCountry: e.target.value })}
        >
          {ISO3_EXPORTERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <p className="small" data-testid="country-heading">
        {iso} · {year}
      </p>
      <p className="muted small">{t("countryPercentileNote")}</p>
      <table data-testid="country-table">
        <thead>
          <tr>
            <th>{t("variables")}</th>
            <th>factor</th>
            <th>{t("parityRaw")}</th>
            <th>{t("countryPercentile")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <PermalinkLink view="data_variable" patch={{ focusVariable: r.id }}>
                  {r.id}
                </PermalinkLink>
              </td>
              <td>{r.factor}</td>
              <td>
                {r.value === null || r.value === undefined
                  ? t("exploreMissing")
                  : String(r.value)}
              </td>
              <td>
                {r.percentile === null
                  ? "—"
                  : `${(r.percentile * 100).toFixed(0)}% (n=${r.nPeers})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        <PermalinkLink view="time" patch={{ compareA: iso }}>
          {t("countryRankHistory")}
        </PermalinkLink>
      </p>
    </PageShell>
  );
}
