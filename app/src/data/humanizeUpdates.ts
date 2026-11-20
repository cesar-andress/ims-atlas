/**
 * Turn raw ETL update summaries into short, language-aware lines for the UI.
 * Never invents counts: only rewrites known patterns and labels sources.
 */

export type UpdateLang = "en" | "es";

const STATUS_LABEL: Record<
  UpdateLang,
  Record<string, string>
> = {
  en: {
    ok: "OK",
    failed: "Failed",
    qa_blocked: "QA blocked",
    running: "Running",
    live: "Live ingest",
    fixture: "Fixture",
  },
  es: {
    ok: "Correcta",
    failed: "Fallida",
    qa_blocked: "Bloqueada por QA",
    running: "En curso",
    live: "Ingestión live",
    fixture: "Fixture",
  },
};

/** Prefer publisher when known; otherwise keep the source id. */
export function sourceLabel(
  sourceId: string,
  publishers: ReadonlyMap<string, string>,
): string {
  const pub = publishers.get(sourceId)?.trim();
  if (!pub) return sourceId;
  // Avoid "World Bank — worldbank_wdi" noise when publisher alone is enough;
  // keep id when several sources share a publisher.
  return `${pub} (${sourceId})`;
}

export function statusLabel(
  status: string | null | undefined,
  lang: UpdateLang,
): string {
  if (!status) return "-";
  const key = status.toLowerCase();
  return STATUS_LABEL[lang][key] ?? status;
}

export function modeLabel(
  mode: string | null | undefined,
  lang: UpdateLang,
): string {
  if (!mode) return "-";
  const key = mode.toLowerCase();
  return STATUS_LABEL[lang][key] ?? mode;
}

function formatRows(n: string, lang: UpdateLang): string {
  const num = Number(n.replace(/_/g, ""));
  if (!Number.isFinite(num)) return n;
  return num.toLocaleString(lang === "es" ? "es-ES" : "en-GB");
}

/**
 * Humanize one summary line from status/updates.json.
 * Unknown shapes are returned unchanged (still truthful).
 */
export function humanizeSummaryLine(
  line: string,
  lang: UpdateLang,
  publishers: ReadonlyMap<string, string>,
): string {
  const raw = line.trim();
  if (!raw) return raw;

  const firstIngest = raw.match(
    /^([a-z0-9_]+):\s*first ingest\s*\(([\d_]+)\s*rows\)$/i,
  );
  if (firstIngest) {
    const [, id, rows] = firstIngest;
    const label = sourceLabel(id!, publishers);
    return lang === "es"
      ? `${label}: primera ingestión (${formatRows(rows!, lang)} filas)`
      : `${label}: first ingest (${formatRows(rows!, lang)} rows)`;
  }

  const unchanged = raw.match(
    /^([a-z0-9_]+):\s*unchanged\s*\(already on disk\)$/i,
  );
  if (unchanged) {
    const label = sourceLabel(unchanged[1]!, publishers);
    return lang === "es"
      ? `${label}: sin cambios (ya en disco)`
      : `${label}: unchanged (already on disk)`;
  }

  // worldbank_lpi; +2007, …; version mini-2022 → 2026-11-11
  const semi = raw.match(/^([a-z0-9_]+);\s*(.+)$/i);
  if (semi) {
    const label = sourceLabel(semi[1]!, publishers);
    let rest = semi[2]!;
    if (lang === "es") {
      rest = rest
        .replace(/\brevised values\b/gi, "valores revisados")
        .replace(/\blargest:\b/gi, "mayor cambio:")
        .replace(/\bversion\b/gi, "versión")
        .replace(/\bfor\b/gi, "en")
        .replace(/\bcountries\b/gi, "países");
    }
    return `${label}: ${rest}`;
  }

  const colon = raw.match(/^([a-z0-9_]+):\s*(.+)$/i);
  if (colon) {
    return `${sourceLabel(colon[1]!, publishers)}: ${colon[2]}`;
  }

  return raw;
}

/** Pick CHANGELOG ## blocks that match the running app version. */
export function changelogBlocksForAppVersion(
  blocks: readonly { heading: string; body: string }[],
  appVersion: string,
): { heading: string; body: string }[] {
  const ver = appVersion.replace(/^v/i, "").trim();
  const matched = blocks.filter((b) => {
    const h = b.heading;
    if (/unreleased/i.test(h)) return true;
    return h.includes(ver);
  });
  return matched.length ? matched : blocks.slice(0, 1);
}
