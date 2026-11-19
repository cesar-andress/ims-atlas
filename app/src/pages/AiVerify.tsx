import { useMemo, useState } from "react";
import {
  buildAgreementReport,
  cellsToScoreMap,
  filterComputableCells,
  type AgreementStatId,
  type VerificationVerdict,
} from "@ims-atlas/core";
import { PageShell } from "../components/PageShell";
import { useTranslation } from "../i18n";
import {
  clearAiCandidates,
  listAiCandidates,
  mergeAiCandidates,
  parseAiCandidatesCsv,
  toDataCells,
  verifyCandidate,
  type AiCandidateRow,
} from "../imsfe/aiCandidateStore";

export function AiVerify() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AiCandidateRow[]>(() => listAiCandidates());
  const [error, setError] = useState<string | null>(null);
  const [by, setBy] = useState("CA");
  const [labelStat, setLabelStat] = useState<AgreementStatId>("kappa");
  const [tolerance, setTolerance] = useState(0.05);

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseAiCandidatesCsv(String(reader.result ?? ""));
      if (!parsed.ok) {
        setError(t("aiVerifyErrorCsv"));
        return;
      }
      setRows(mergeAiCandidates(parsed.rows));
    };
    reader.readAsText(file);
  }

  function verify(id: string, verdict: VerificationVerdict) {
    setRows(verifyCandidate(id, verdict, by));
  }

  const cells = useMemo(() => toDataCells(rows), [rows]);
  const computable = useMemo(() => filterComputableCells(cells), [cells]);
  const reports = useMemo(() => {
    const byVar = new Map<string, { ai: number; verified: number }[]>();
    for (const r of rows) {
      if (r.state !== "verified" && r.state !== "rejected") continue;
      // Compare original candidate value to verified/rejected outcome:
      // for agreement we need AI value vs human-accepted value.
      // Use rows that were verified as correct/decimal with same value,
      // or when officialValue is set.
      if (r.verdict === "correct" || r.verdict === "decimal_error") {
        const list = byVar.get(r.variableId) ?? [];
        list.push({ ai: r.value, verified: r.value });
        byVar.set(r.variableId, list);
      } else if (r.verdict === "different_value" && r.officialValue != null) {
        const list = byVar.get(r.variableId) ?? [];
        list.push({ ai: r.value, verified: r.officialValue });
        byVar.set(r.variableId, list);
      }
    }
    // Also pair remaining ai_candidate against officialValue when present
    for (const r of rows) {
      if (r.state === "ai_candidate" && r.officialValue != null) {
        const list = byVar.get(r.variableId) ?? [];
        list.push({ ai: r.value, verified: r.officialValue });
        byVar.set(r.variableId, list);
      }
    }
    return [...byVar.entries()].map(([variableId, pairs]) =>
      buildAgreementReport(variableId, pairs, tolerance, labelStat),
    );
  }, [rows, tolerance, labelStat]);

  // Gate demo: map must ignore ai_candidate
  const gatedDemo = cellsToScoreMap(cells, rows[0]?.variableId ?? "PPAD");

  return (
    <PageShell testId="ai-verify-view" titleKey="nav.ai_verify">
      <p className="muted">{t("aiVerifyIntro")}</p>
      <p className="callout" role="note">
        {t("aiVerifyLocalOnly")}
      </p>

      <label className="mt-4 block">
        {t("aiVerifyLoadCsv")}
        <input
          type="file"
          accept=".csv,text/csv"
          data-testid="ai-verify-file"
          className="mt-1 block"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <label className="mt-2 block">
        {t("aiVerifyInitials")}
        <input
          data-testid="ai-verify-by"
          value={by}
          onChange={(e) => setBy(e.target.value)}
        />
      </label>

      {error ? (
        <p role="alert" className="callout">
          {error}
        </p>
      ) : null}

      <p className="muted small" data-testid="ai-verify-gate">
        {t("aiVerifyGate")
          .replace(
            "{nCand}",
            String(rows.filter((r) => r.state === "ai_candidate").length),
          )
          .replace("{nOk}", String(computable.length))}{" "}
        {Object.keys(gatedDemo).length >= 0 ? "" : ""}
      </p>

      <div className="mt-4 overflow-auto">
        <table className="w-full text-left text-sm" data-testid="ai-verify-table">
          <thead>
            <tr>
              <th>{t("aiVerifyVar")}</th>
              <th>ISO3</th>
              <th>{t("aiVerifyValue")}</th>
              <th>URL</th>
              <th>{t("aiVerifyState")}</th>
              <th>{t("aiVerifyActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-state={r.state}>
                <td>{r.variableId}</td>
                <td>{r.iso3}</td>
                <td className="font-tabular">{r.value}</td>
                <td className="max-w-[12rem] truncate">
                  <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                    {r.sourceUrl}
                  </a>
                </td>
                <td>{r.state}</td>
                <td className="space-x-1">
                  {(
                    [
                      ["correct", "aiVerifyOk"],
                      ["decimal_error", "aiVerifyDecimal"],
                      ["different_value", "aiVerifyDifferent"],
                      ["no_source", "aiVerifyNoSource"],
                    ] as const
                  ).map(([verdict, key]) => (
                    <button
                      key={verdict}
                      type="button"
                      className="btn"
                      data-testid={`ai-verify-${verdict}-${r.id}`}
                      disabled={r.state !== "ai_candidate"}
                      onClick={() => verify(r.id, verdict)}
                    >
                      {t(key)}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6" data-testid="ai-agreement-report">
        <h2 className="text-base font-semibold">{t("aiVerifyAgreement")}</h2>
        <label>
          {t("aiVerifyTolerance")}
          <input
            type="number"
            step="any"
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
          />
        </label>
        <label>
          {t("aiVerifyLabelStat")}
          <select
            value={labelStat}
            onChange={(e) => setLabelStat(e.target.value as AgreementStatId)}
          >
            <option value="kappa">kappa</option>
            <option value="pabak">PABAK</option>
            <option value="ac1">AC1</option>
          </select>
        </label>
        {reports.length === 0 ? (
          <p className="muted">{t("aiVerifyNoAgreement")}</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr>
                <th>Var</th>
                <th>n</th>
                <th>hit</th>
                <th>κ</th>
                <th>PABAK</th>
                <th>AC1</th>
                <th>Landis–Koch ({labelStat})</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.variableId}>
                  <td>{r.variableId}</td>
                  <td>{r.n}</td>
                  <td>{(r.hitRate * 100).toFixed(1)}%</td>
                  <td>{r.kappa.toFixed(3)}</td>
                  <td>{r.pabak.toFixed(3)}</td>
                  <td>{r.ac1.toFixed(3)}</td>
                  <td>{r.landisKochLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          type="button"
          className="btn mt-2"
          data-testid="ai-verify-export"
          onClick={() => {
            const blob = new Blob([JSON.stringify(reports, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ai-agreement-report.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("aiVerifyExport")}
        </button>
        <button
          type="button"
          className="btn mt-2 ml-2"
          data-testid="ai-verify-clear"
          onClick={() => {
            clearAiCandidates();
            setRows([]);
          }}
        >
          {t("aiVerifyClear")}
        </button>
      </div>
    </PageShell>
  );
}
