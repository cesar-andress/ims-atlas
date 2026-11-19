import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";

export type AppVersionInfo = {
  buildId: string;
  version: string;
  builtAt: string;
};

const POLL_MS = 10 * 60 * 1000;

function versionUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/version.json`;
}

async function fetchVersion(): Promise<AppVersionInfo | null> {
  try {
    const res = await fetch(versionUrl(), { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<AppVersionInfo>;
    if (!body.buildId || !body.version) return null;
    return {
      buildId: String(body.buildId),
      version: String(body.version),
      builtAt: String(body.builtAt ?? ""),
    };
  } catch {
    return null;
  }
}

/** Poll /version.json; show reload CTA when the deployed build id changes. */
export function AppUpdateBanner() {
  const { t } = useTranslation();
  const [initial, setInitial] = useState<AppVersionInfo | null>(null);
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      const first = await fetchVersion();
      if (cancelled || !first) return;
      setInitial(first);
      timer = setInterval(() => {
        void (async () => {
          const next = await fetchVersion();
          if (cancelled || !next || !first) return;
          if (next.buildId !== first.buildId) {
            setOutdated(true);
          }
        })();
      }, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  if (!outdated || !initial) return null;

  return (
    <div className="app-update-banner" role="status" data-testid="app-update-banner">
      <span>{t("appUpdateBanner")}</span>
      <button type="button" onClick={() => window.location.reload()}>
        {t("appUpdateReload")}
      </button>
    </div>
  );
}
