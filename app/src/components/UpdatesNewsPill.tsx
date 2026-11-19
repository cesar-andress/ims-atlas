import { useEffect, useState } from "react";
import { PermalinkLink } from "./PermalinkLink";
import { loadUpdates, type TransparencyUpdates } from "../data/transparency";
import { useTranslation } from "../i18n";

const STORAGE_KEY = "ims-atlas-last-seen-run";

function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(runId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, runId);
  } catch {
    // private mode / blocked storage — pill still works for this session
  }
}

/** Header pill: changes since the last run the user marked as seen (local only). */
export function UpdatesNewsPill() {
  const { t } = useTranslation();
  const [updates, setUpdates] = useState<TransparencyUpdates | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    setLastSeen(readLastSeen());
    void loadUpdates()
      .then(setUpdates)
      .catch(() => setUpdates(null));
  }, []);

  if (!updates || updates.runs.length === 0) return null;
  const latest = updates.runs[0]!;
  const unseen = lastSeen
    ? updates.runs.filter((r) => r.run_id !== lastSeen)
    : updates.runs;
  // Only count runs after lastSeen until we hit it in chronological export (newest first).
  const newer: typeof updates.runs = [];
  for (const run of updates.runs) {
    if (lastSeen && run.run_id === lastSeen) break;
    newer.push(run);
  }
  const n = lastSeen ? newer.length : 0;
  if (n === 0 && lastSeen) {
    return (
      <PermalinkLink
        view="data_updates"
        className="news-pill muted"
        data-testid="news-pill"
      >
        {t("newsPillNone")}
      </PermalinkLink>
    );
  }

  return (
    <PermalinkLink
      view="data_updates"
      className="news-pill"
      data-testid="news-pill"
      onClick={() => {
        if (latest.run_id) {
          writeLastSeen(latest.run_id);
          setLastSeen(latest.run_id);
        }
      }}
      title={unseen
        .flatMap((r) => r.summaries ?? [])
        .slice(0, 5)
        .join(" · ")}
    >
      {n > 0 ? t("newsPillCount").replace("{n}", String(n)) : t("newsPillFirst")}
    </PermalinkLink>
  );
}
