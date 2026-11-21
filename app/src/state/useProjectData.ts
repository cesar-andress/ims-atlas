import { useEffect, useMemo, useState } from "react";
import {
  loadSources,
  loadVariables,
  type TransparencySource,
  type TransparencyVariable,
} from "../data/transparency";
import type { DemoPanel } from "../ranking/demoPanel";
import { loadProjectPanel } from "../ranking/projectPanel";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "./useAnalysis";
import { isAnalysisReady } from "./views";

export type DataAccess = "open" | "team" | "unknown";

export type DataRow = {
  id: string;
  name: string;
  sources: string;
  access: DataAccess;
  /** ISO timestamp of the last ingest, when the status files report one. */
  lastIngested: string | null;
  /** Markets (candidates) with a value for this variable; null when no panel. */
  withData: number | null;
  markets: number | null;
};

export type DataWarning = { id: string; text: string };

type Bundle = {
  panel: DemoPanel | null;
  variables: TransparencyVariable[];
  sources: TransparencySource[];
};

function loadBundle(scope: {
  origin?: string;
  hs?: string;
  year?: number;
  ready: boolean;
}): Promise<Bundle> {
  const panelP = scope.ready
    ? loadProjectPanel({
        origin: scope.origin,
        hs: scope.hs,
        year: scope.year,
      }).catch(() => null)
    : Promise.resolve(null);
  return Promise.all([
    panelP,
    loadVariables()
      .then((r) => r.variables)
      .catch(() => [] as TransparencyVariable[]),
    loadSources()
      .then((r) => r.sources)
      .catch(() => [] as TransparencySource[]),
  ]).then(([panel, variables, sources]) => ({ panel, variables, sources }));
}

function localName(
  name: TransparencyVariable["name"] | undefined,
  id: string,
  lang: "en" | "es",
): string {
  if (typeof name === "string" && name) return name;
  if (name && typeof name === "object") return name[lang] ?? name.en ?? id;
  return id;
}

const MAX_MISSING_WARNINGS = 5;

/** One table of the data a project uses, plus plain-language warnings (step 1). */
export function useProjectData(): {
  loading: boolean;
  rows: DataRow[];
  warnings: DataWarning[];
  nSources: number;
} {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config } = useAnalysis();
  const { error } = useRankingModel();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const ready = isAnalysisReady(config);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    const scope: {
      origin?: string;
      hs?: string;
      year?: number;
      ready: boolean;
    } = { ready };
    if (config.origin) scope.origin = config.origin;
    if (config.hs) scope.hs = config.hs;
    if (config.year != null) scope.year = config.year;
    void loadBundle(scope).then((b) => {
      if (!cancelled) setBundle(b);
    });
    return () => {
      cancelled = true;
    };
  }, [config.origin, config.hs, config.year, ready]);

  return useMemo(() => {
    if (!bundle) return { loading: true, rows: [], warnings: [], nSources: 0 };
    const { panel, variables, sources } = bundle;
    const byId = new Map(variables.map((v) => [v.id, v]));
    const sourceById = new Map(sources.map((s) => [s.id, s]));
    const nMarkets = panel?.candidates.length ?? null;

    const ids = panel ? panel.variables.map((v) => v.id) : variables.map((v) => v.id);
    const rows: DataRow[] = ids.map((id) => {
      const meta = byId.get(id);
      const sourceIds = meta?.source_ids ?? [];
      const sourceLabel =
        sourceIds
          .map((sid) => sourceById.get(sid)?.publisher ?? sid)
          .filter((x, i, a) => a.indexOf(x) === i)
          .join(", ") || "-";
      let withData: number | null = null;
      if (panel) {
        const col = panel.variables.findIndex((v) => v.id === id);
        withData =
          col < 0
            ? null
            : panel.values.reduce((n, row) => {
                const v = row[col];
                return typeof v === "number" && Number.isFinite(v) ? n + 1 : n;
              }, 0);
      }
      const access: DataAccess =
        meta?.redistributable === true
          ? "open"
          : meta?.redistributable === false
            ? "team"
            : "unknown";
      return {
        id,
        name: localName(meta?.name, id, lang),
        sources: sourceLabel,
        access,
        lastIngested: meta?.last_ingested ?? null,
        withData,
        markets: nMarkets,
      };
    });

    const warnings: DataWarning[] = [];
    if (error?.kind === "pending") {
      warnings.push({ id: "pending", text: error.message || t("dataReleasePending") });
    }
    if (panel?.synthetic) {
      warnings.push({ id: "synthetic", text: t("demoSyntheticNote") });
    }
    const incomplete = rows
      .filter(
        (r) => r.withData !== null && r.markets !== null && r.withData < r.markets,
      )
      .sort((a, b) => b.markets! - b.withData! - (a.markets! - a.withData!));
    for (const r of incomplete.slice(0, MAX_MISSING_WARNINGS)) {
      warnings.push({
        id: `missing-${r.id}`,
        text: t("datosWarnMissing")
          .replace("{name}", r.name)
          .replace("{missing}", String(r.markets! - r.withData!))
          .replace("{total}", String(r.markets!)),
      });
    }
    if (incomplete.length > MAX_MISSING_WARNINGS) {
      warnings.push({
        id: "missing-more",
        text: t("datosWarnMore").replace(
          "{n}",
          String(incomplete.length - MAX_MISSING_WARNINGS),
        ),
      });
    }

    const used = new Set(rows.flatMap((r) => byId.get(r.id)?.source_ids ?? []));
    return { loading: false, rows, warnings, nSources: used.size };
  }, [bundle, error, lang, t]);
}
