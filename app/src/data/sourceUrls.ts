/**
 * Real source URLs from transparency / sources.yaml fields.
 * Never invents URLs — only returns http(s) strings already present.
 */

export type SourceUrlKind = "landing" | "terms" | "licence" | "download";

export type SourceUrlLink = {
  kind: SourceUrlKind;
  url: string;
  /** Optional endpoint id when kind is download. */
  endpointId?: string;
};

export type SourceUrlFields = {
  id?: string | null;
  landing_url?: string | null;
  terms_url?: string | null;
  licence_url?: string | null;
  endpoints?:
    | {
        id?: string | null;
        template?: string | null;
      }[]
    | null;
};

function isRealHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s || s.toUpperCase() === "UNKNOWN") return false;
  return /^https?:\/\//i.test(s);
}

/** Collect landing / terms / licence / download template URLs for one source. */
export function collectSourceUrls(source: SourceUrlFields): SourceUrlLink[] {
  const out: SourceUrlLink[] = [];
  const seen = new Set<string>();

  const push = (kind: SourceUrlKind, raw: unknown, endpointId?: string) => {
    if (!isRealHttpUrl(raw)) return;
    const url = raw.trim();
    const key = `${kind}|${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    const link: SourceUrlLink = { kind, url };
    if (endpointId) link.endpointId = endpointId;
    out.push(link);
  };

  push("landing", source.landing_url);
  push("terms", source.terms_url);
  push("licence", source.licence_url);
  for (const ep of source.endpoints ?? []) {
    push("download", ep?.template, ep?.id ? String(ep.id) : undefined);
  }
  return out;
}

/** Links for every source id of a variable (order preserved, deduped by URL+kind). */
export function collectVariableSourceUrls(
  sourceIds: readonly string[],
  sourcesById: ReadonlyMap<string, SourceUrlFields>,
): { sourceId: string; links: SourceUrlLink[] }[] {
  const out: { sourceId: string; links: SourceUrlLink[] }[] = [];
  for (const sid of sourceIds) {
    const src = sourcesById.get(sid);
    if (!src) {
      out.push({ sourceId: sid, links: [] });
      continue;
    }
    out.push({ sourceId: sid, links: collectSourceUrls(src) });
  }
  return out;
}
