/** Friendly relative timestamps for project lists (B2). */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Spanish/English relative edit labels: «hoy, 9:18», «ayer, 18:40»,
 * or a short calendar date when older.
 */
export function formatProjectEditedAt(
  iso: string,
  lang: "en" | "es",
  nowMs = Date.now(),
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t);
  const now = new Date(nowMs);
  const time = new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);

  const startOfDay = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / DAY);

  if (dayDiff === 0) {
    return lang === "es" ? `hoy, ${time}` : `today, ${time}`;
  }
  if (dayDiff === 1) {
    return lang === "es" ? `ayer, ${time}` : `yesterday, ${time}`;
  }
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
      weekday: "long",
    }).format(d);
    return `${weekday}, ${time}`;
  }
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
