import { useState } from "react";
import { releaseUrl } from "../dataConfig";
import { useTranslation } from "../i18n";

export type ProvenanceRow = {
  table?: string;
  iso3?: string | null;
  iso3_o?: string | null;
  iso3_d?: string | null;
  year: number;
  variable_id: string;
  source_id: string;
  upstream_code?: string | null;
  upstream_version: string;
  request_url_or_file: string;
  row_key: string;
  raw_sha256: string;
  transform_steps: string[];
  flag_imputed: boolean;
  flag_locf: boolean;
  flag_unit_converted: boolean;
  flag_iso3_remap: boolean;
  value?: number | null;
};

type Props = {
  variableId: string;
  iso3?: string;
  year?: number;
  /** Display value from the UI (may be normalised); provenance.value is raw when present. */
  displayValue?: number | null;
  sourceIds?: string[];
};

type LiveCheck =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ok";
      match: boolean;
      live: number | null;
      stored: number | null;
      lastupdated: string | null;
    }
  | { status: "error"; message: string };

function wbCountryIndicatorUrl(code: string, iso3: string, year: number): string {
  return (
    `https://api.worldbank.org/v2/country/${encodeURIComponent(iso3)}` +
    `/indicator/${encodeURIComponent(code)}` +
    `?format=json&date=${year}:${year}&per_page=1`
  );
}

async function loadProvenanceRow(
  variableId: string,
  iso3: string | undefined,
  year: number | undefined,
): Promise<ProvenanceRow | null> {
  if (!iso3 || year === undefined) return null;
  const url = releaseUrl("provenance.jsonl");
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as ProvenanceRow;
      if (
        row.variable_id === variableId &&
        row.iso3 === iso3 &&
        Number(row.year) === year
      ) {
        return row;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function plainTransform(row: ProvenanceRow, t: (k: string) => string): string {
  const steps = row.transform_steps ?? [];
  const flags: string[] = [];
  if (row.flag_imputed) flags.push(t("verifyFlagImputed"));
  if (row.flag_locf) flags.push(t("verifyFlagLocf"));
  if (row.flag_unit_converted) flags.push(t("verifyFlagUnits"));
  if (row.flag_iso3_remap) flags.push(t("verifyFlagIso3"));
  const parts = [
    t("verifyRawLine")
      .replace("{code}", row.upstream_code ?? row.variable_id)
      .replace("{year}", String(row.year))
      .replace("{value}", row.value == null ? "-" : String(row.value)),
    steps.length ? t("verifySteps").replace("{steps}", steps.join(", ")) : null,
    flags.length ? flags.join("; ") : null,
  ].filter(Boolean);
  return parts.join(" ");
}

/** Panel: provenance + optional live World Bank check (browser CORS, no proxy). */
export function VerifyDatumPanel({
  variableId,
  iso3,
  year,
  displayValue,
  sourceIds = [],
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<ProvenanceRow | null | undefined>(undefined);
  const [live, setLive] = useState<LiveCheck>({ status: "idle" });
  const isWb =
    sourceIds.some((s) => s.startsWith("worldbank_")) ||
    Boolean(row && row.source_id.startsWith("worldbank_"));

  async function openPanel() {
    setOpen(true);
    setLive({ status: "idle" });
    setRow(undefined);
    const found = await loadProvenanceRow(variableId, iso3, year);
    setRow(found);
  }

  async function checkNow(prov: ProvenanceRow) {
    if (!iso3 || year === undefined || !prov.upstream_code) {
      setLive({ status: "error", message: t("verifyLiveMissing") });
      return;
    }
    setLive({ status: "loading" });
    const url = wbCountryIndicatorUrl(prov.upstream_code, iso3, year);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setLive({
          status: "error",
          message: t("verifyLiveHttp").replace("{status}", String(res.status)),
        });
        return;
      }
      const payload = (await res.json()) as unknown;
      let liveVal: number | null = null;
      let lastupdated: string | null = null;
      if (Array.isArray(payload) && payload[0] && typeof payload[0] === "object") {
        const meta = payload[0] as { lastupdated?: string };
        lastupdated = meta.lastupdated ?? null;
        const rows = payload[1];
        if (Array.isArray(rows) && rows[0] && typeof rows[0] === "object") {
          const v = (rows[0] as { value?: unknown }).value;
          liveVal = typeof v === "number" ? v : v == null ? null : Number(v);
          if (liveVal !== null && Number.isNaN(liveVal)) liveVal = null;
        }
      }
      const stored = prov.value ?? null;
      const match =
        liveVal !== null &&
        stored !== null &&
        Math.abs(liveVal - stored) <= 1e-9 * Math.max(1, Math.abs(stored));
      setLive({ status: "ok", match, live: liveVal, stored, lastupdated });
    } catch (err) {
      setLive({
        status: "error",
        message: err instanceof Error ? err.message : t("verifyLiveFailed"),
      });
    }
  }

  return (
    <span className="verify-datum">
      <button
        type="button"
        className="linkish"
        data-testid="verify-datum-open"
        onClick={() => void openPanel()}
      >
        {t("verifyDatum")}
      </button>
      {open ? (
        <div
          className="verify-datum-panel"
          role="dialog"
          data-testid="verify-datum-panel"
        >
          <header>
            <strong>
              {variableId}
              {iso3 ? ` · ${iso3}` : ""}
              {year !== undefined ? ` · ${year}` : ""}
            </strong>
            <button type="button" onClick={() => setOpen(false)}>
              {t("close")}
            </button>
          </header>
          {row === undefined ? (
            <p className="muted">{t("loading")}</p>
          ) : row === null ? (
            <p className="muted" data-testid="verify-no-provenance">
              {t("verifyNoProvenance")}
            </p>
          ) : (
            <>
              <dl className="status-grid">
                <dt>{t("verifySource")}</dt>
                <dd data-from-json="source_id">{row.source_id}</dd>
                <dt>{t("verifyUpstreamCode")}</dt>
                <dd data-from-json="upstream_code">{row.upstream_code ?? "-"}</dd>
                <dt>{t("verifyUpstreamVersion")}</dt>
                <dd data-from-json="upstream_version">{row.upstream_version}</dd>
                <dt>{t("verifyRequest")}</dt>
                <dd>
                  {row.request_url_or_file.startsWith("http") ? (
                    <a
                      href={row.request_url_or_file}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {row.request_url_or_file}
                    </a>
                  ) : (
                    <code>{row.request_url_or_file}</code>
                  )}
                </dd>
                <dt>{t("verifyRowKey")}</dt>
                <dd>
                  <code>{row.row_key}</code>
                </dd>
                <dt>{t("verifyRawSha")}</dt>
                <dd>
                  <code>{row.raw_sha256.slice(0, 16)}…</code>
                </dd>
                <dt>{t("verifyDisplayValue")}</dt>
                <dd>{displayValue == null ? "-" : String(displayValue)}</dd>
              </dl>
              <p data-testid="verify-transform">{plainTransform(row, t)}</p>
              {isWb && row.upstream_code ? (
                <p>
                  <button
                    type="button"
                    data-testid="verify-live"
                    disabled={live.status === "loading"}
                    onClick={() => void checkNow(row)}
                  >
                    {t("verifyLive")}
                  </button>
                </p>
              ) : (
                <p className="muted small">{t("verifyLiveOnlyWb")}</p>
              )}
              {live.status === "loading" ? (
                <p className="muted">{t("loading")}</p>
              ) : null}
              {live.status === "error" ? (
                <p className="error" role="alert">
                  {live.message}
                </p>
              ) : null}
              {live.status === "ok" ? (
                <p
                  data-testid="verify-live-result"
                  className={live.match ? "ok" : "error"}
                >
                  {live.match ? t("verifyLiveMatch") : t("verifyLiveDiffer")}
                  {": "}
                  {t("verifyLiveStored")}={live.stored ?? "-"},{" "}
                  {t("verifyLiveUpstream")}={live.live ?? "-"}
                  {live.lastupdated
                    ? ` (${t("verifyLastUpdated")} ${live.lastupdated})`
                    : ""}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </span>
  );
}
