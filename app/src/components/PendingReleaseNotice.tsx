import { useEffect, useState } from "react";
import { loadAccessConfig } from "../auth/accessConfig";
import { useTranslation } from "../i18n";
import { COL_HS64_PRESET } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";
import { PermalinkLink } from "./PermalinkLink";

type Props = {
  detail?: string | undefined;
};

type ReleaseHint = {
  tradeRows: number;
  draftShipVars: number;
};

async function loadReleaseHint(): Promise<ReleaseHint> {
  try {
    // Only status/releases.json (~KB). Never fetch data/*/manifest.json here:
    // the full manifest lists every parquet part (~2 MiB / 7k+ files).
    const base = import.meta.env.BASE_URL;
    const releasesRes = await fetch(`${base}status/releases.json`, {
      cache: "no-store",
    });
    let draftShipVars = 33;
    let tradeRows = 0;
    if (releasesRes.ok) {
      const rel = (await releasesRes.json()) as {
        internal?: {
          n_included_variables?: number;
          row_counts?: { trade_rows?: number };
        };
        releases?: {
          n_included_variables?: number;
          row_counts?: { trade_rows?: number };
        }[];
      };
      const publicRel = rel.releases?.[0];
      const internalN = rel.internal?.n_included_variables;
      const publicN = publicRel?.n_included_variables ?? 0;
      if (typeof internalN === "number" && internalN > publicN) {
        draftShipVars = internalN - publicN;
      }
      tradeRows = Number(
        publicRel?.row_counts?.trade_rows ?? rel.internal?.row_counts?.trade_rows ?? 0,
      );
    }
    return { tradeRows, draftShipVars };
  } catch {
    return { tradeRows: 0, draftShipVars: 33 };
  }
}

/** Empty-state when the public verified panel is not ready. */
export function PendingReleaseNotice({ detail }: Props) {
  const { t, i18n } = useTranslation();
  const { config, replaceConfig } = useAnalysis();
  const [hint, setHint] = useState<ReleaseHint | null>(null);
  const [portal, setPortal] = useState<string | null>(null);

  useEffect(() => {
    void loadReleaseHint().then(setHint);
    void loadAccessConfig()
      .then((cfg) => setPortal(cfg.auth.portal_url))
      .catch(() => setPortal(null));
  }, []);

  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const n = hint?.draftShipVars ?? 33;
  const hasTrade = (hint?.tradeRows ?? 0) > 0;
  const body = hasTrade
    ? t("dataReleasePendingTradeOk").replace("{n}", String(n))
    : t("dataReleasePending");
  const detailLine =
    detail && detail !== "TEAM_RESULTS_PENDING" && !/baci/i.test(detail)
      ? detail
      : hasTrade
        ? t("dataReleasePendingDetail").replace("{n}", String(n))
        : undefined;

  const onExample = () => {
    replaceConfig({
      ...COL_HS64_PRESET,
      view: "ranking",
      lang: config.lang ?? lang,
    });
  };

  const onLogin = () => {
    if (!portal) return;
    const rd = encodeURIComponent(window.location.href);
    window.location.assign(`${portal.replace(/\/$/, "")}/?rd=${rd}`);
  };

  return (
    <div className="analysis-empty" role="alert" data-testid="data-release-pending">
      <p>{body}</p>
      {detailLine ? <p className="muted small">{detailLine}</p> : null}
      <p className="analysis-actions">
        <button
          type="button"
          className="btn"
          data-testid="pending-see-example"
          onClick={onExample}
        >
          {t("seeExample")}
        </button>{" "}
        <button
          type="button"
          className="btn ghost"
          data-testid="pending-team-login"
          onClick={onLogin}
          disabled={!portal}
        >
          {t("access.login")}
        </button>
      </p>
      <p className="analysis-actions muted small">
        <PermalinkLink
          view="data_sources"
          hash="estado"
          data-testid="pending-link-status"
        >
          {t("dataMissingLink")}
        </PermalinkLink>
        {" · "}
        <PermalinkLink view="byod">{t("nav.byod")}</PermalinkLink>
      </p>
    </div>
  );
}
