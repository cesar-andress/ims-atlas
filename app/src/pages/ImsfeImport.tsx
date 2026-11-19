import { useState } from "react";
import { PageShell } from "../components/PageShell";
import { useTranslation } from "../i18n";
import {
  exportImportReportJson,
  parseImsfeImportReportJson,
  rankedScores,
  type ImsfeImportReport,
} from "../imsfe/importReport";

export function ImsfeImport() {
  const { t } = useTranslation();
  const [report, setReport] = useState<ImsfeImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseImsfeImportReportJson(text);
      if (!parsed.ok) {
        const key =
          parsed.error === "invalid_json"
            ? "imsfeImportErrorInvalidJson"
            : parsed.error === "non_anonymous_expert" ||
                parsed.error === "personal_token"
              ? "imsfeImportErrorPersonal"
              : parsed.error === "no_scores"
                ? "imsfeImportErrorNoScores"
                : "imsfeImportErrorGeneric";
        setError(t(key));
        setReport(null);
        return;
      }
      setReport(parsed.report);
    };
    reader.readAsText(file);
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([exportImportReportJson(report)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imsfe-import-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const ranked = report ? rankedScores(report.final_scores) : [];

  return (
    <PageShell testId="imsfe-import-view" titleKey="nav.imsfe_import">
      <p className="muted">{t("imsfeImportIntro")}</p>
      <p className="callout" role="note" data-testid="imsfe-import-cli-hint">
        {t("imsfeImportCliHint")}
      </p>

      <label className="mt-4 block">
        <span className="text-sm font-medium">{t("imsfeImportLoad")}</span>
        <input
          type="file"
          accept="application/json,.json"
          data-testid="imsfe-import-file"
          className="mt-1 block"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error ? (
        <p className="callout" data-testid="imsfe-import-error" role="alert">
          {error}
        </p>
      ) : null}

      {report ? (
        <div className="mt-6 space-y-4" data-testid="imsfe-import-report">
          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="m-0 text-base font-semibold">{t("imsfeImportSummary")}</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt>{t("imsfeImportLabel")}</dt>
              <dd className="m-0">{report.path_label}</dd>
              <dt>{t("imsfeImportOrigin")}</dt>
              <dd className="m-0">{report.origin ?? "—"}</dd>
              <dt>{t("imsfeImportHs")}</dt>
              <dd className="m-0">{report.hs_code ?? "—"}</dd>
              <dt>{t("imsfeImportScale")}</dt>
              <dd className="m-0">{report.scale ?? "—"}</dd>
              <dt>{t("imsfeImportCriteria")}</dt>
              <dd className="m-0">
                {report.n_criteria} / {report.n_variables} / {report.n_experts}
              </dd>
            </dl>
            <p className="muted mt-2 text-sm">
              {t("imsfeImportExperts")}: {report.expert_labels.join(", ")}
            </p>
          </div>

          {report.warnings.length > 0 ? (
            <div
              className="rounded-card border border-border bg-surface p-4"
              data-testid="imsfe-import-warnings"
            >
              <h2 className="m-0 text-base font-semibold">
                {t("imsfeImportWarnings")}
              </h2>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {report.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {report.assumptions.length > 0 ? (
            <div className="rounded-card border border-border bg-surface p-4">
              <h2 className="m-0 text-base font-semibold">
                {t("imsfeImportAssumptions")}
              </h2>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {report.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-base font-semibold">{t("imsfeImportScores")}</h2>
              <button
                type="button"
                className="btn"
                data-testid="imsfe-import-download"
                onClick={downloadReport}
              >
                {t("imsfeImportDownload")}
              </button>
            </div>
            <div className="mt-2 max-h-96 overflow-auto">
              <table
                className="w-full text-left text-sm"
                data-testid="imsfe-import-scores"
              >
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("imsfeImportCountry")}</th>
                    <th>{t("imsfeImportScore")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => (
                    <tr key={row.country}>
                      <td>{row.rank}</td>
                      <td>{row.country}</td>
                      <td>{row.score.toFixed(10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
