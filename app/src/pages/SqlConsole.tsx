import { useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { createDuckDbClient } from "../data/duckdbClient";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

const EXAMPLES = [
  "SELECT * FROM country_year LIMIT 20",
  "SELECT variable_id, count(*) AS n FROM country_year GROUP BY 1 ORDER BY n DESC LIMIT 20",
  "SELECT iso3, year, value FROM country_year WHERE variable_id = 'GDPPC' LIMIT 50",
  "SELECT year, count(*) AS cells FROM country_year GROUP BY 1 ORDER BY 1",
  "SELECT * FROM bilateral_year LIMIT 10",
] as const;

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE\s+OR\s+REPLACE\s+TABLE|ATTACH|COPY|EXPORT|PRAGMA|CALL)\b/i;

/** Phase E expert SQL console (read-only). */
export function SqlConsole() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const expert = Boolean(config.expertMode);
  const [sql, setSql] = useState<string>(EXAMPLES[0]);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const client = useMemo(() => createDuckDbClient(), []);

  async function run() {
    setError(null);
    setRows(null);
    if (FORBIDDEN.test(sql)) {
      setError(t("sqlForbidden"));
      return;
    }
    setRunning(true);
    try {
      await client.init();
      try {
        await client.loadRelease();
      } catch (err) {
        setError(
          `${t("sqlNoRelease")} ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
      const out = await client.querySql(sql);
      setRows(out.slice(0, 500));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  if (!expert) {
    return (
      <PageShell testId="sql-view" titleKey="nav.sql">
        <p data-testid="sql-locked">{t("sqlLocked")}</p>
        <button
          type="button"
          data-testid="sql-enable-expert"
          onClick={() => setConfig({ expertMode: true })}
        >
          {t("sqlEnableExpert")}
        </button>
      </PageShell>
    );
  }

  const cols = rows && rows[0] ? Object.keys(rows[0]) : [];

  return (
    <PageShell testId="sql-view" titleKey="nav.sql" className="sql-page">
      <p className="muted">{t("sqlIntro")}</p>
      <div className="sql-examples" data-testid="sql-examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => setSql(ex)}>
            {ex.slice(0, 48)}…
          </button>
        ))}
      </div>
      <textarea
        data-testid="sql-input"
        rows={6}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
      />
      <button
        type="button"
        data-testid="sql-run"
        disabled={running}
        onClick={() => void run()}
      >
        {running ? t("loading") : t("sqlRun")}
      </button>
      {error ? (
        <p className="error" role="alert" data-testid="sql-error">
          {error}
        </p>
      ) : null}
      {rows ? (
        <div className="explore-table-wrap">
          <table data-testid="sql-result">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>
                      {r[c] === null || r[c] === undefined
                        ? t("exploreMissing")
                        : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageShell>
  );
}
