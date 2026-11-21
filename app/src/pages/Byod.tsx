import { useState } from "react";
import { useTranslation } from "../i18n";
import { PageShell } from "../components/PageShell";
import {
  addByodVariable,
  clearByodVariables,
  listByodVariables,
  parseByodCsv,
  removeByodVariable,
  type ByodVariable,
} from "../byod/byodStore";
import { BYOD_TEMPLATE_FILENAME, byodTemplatePublicPath } from "../byod/byodTemplate";
import type { Direction } from "@ims-atlas/core";

const FACTORS = ["COST", "LOGI", "COMM", "ECON", "POLI", "CULT"] as const;

export function Byod() {
  const { t } = useTranslation();
  const [vars, setVars] = useState<ByodVariable[]>(() => listByodVariables());
  const [id, setId] = useState("MYVAR");
  const [label, setLabel] = useState("");
  const [direction, setDirection] = useState<Direction>("benefit");
  const [factor, setFactor] = useState<(typeof FACTORS)[number]>("ECON");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  function refresh() {
    setVars(listByodVariables());
  }

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setWarnings([]);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseByodCsv(text);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      try {
        addByodVariable({
          id,
          label: label || id,
          direction,
          factor,
          rows: parsed.rows,
        });
        setWarnings(parsed.warnings);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    // FileReader is local-only; never fetch/upload the CSV.
    reader.readAsText(file);
  }

  return (
    <PageShell testId="byod-view" titleKey="nav.byod" className="byod">
      <p className="muted">{t("byodIntro")}</p>
      <p className="callout" data-testid="byod-local-only" role="note">
        {t("byodLocalOnly")}
      </p>
      <p className="byod-template-row" data-testid="byod-template-row">
        <a
          className="byod-template-link"
          href={byodTemplatePublicPath(import.meta.env.BASE_URL || "/")}
          download={BYOD_TEMPLATE_FILENAME}
          data-testid="byod-template-download"
        >
          {t("datosDownloadTemplate")}
        </a>
        <span className="muted small">
          {" · "}
          {t("datosTemplateLegend")}
        </span>
      </p>

      <form
        className="byod-form"
        data-testid="byod-form"
        onSubmit={(e) => e.preventDefault()}
      >
        <label>
          ID
          <input
            value={id}
            data-testid="byod-id"
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <label>
          {t("byodLabel")}
          <input
            value={label}
            data-testid="byod-label"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label>
          {t("byodDirection")}
          <select
            value={direction}
            data-testid="byod-direction"
            onChange={(e) => setDirection(e.target.value as Direction)}
          >
            <option value="benefit">benefit</option>
            <option value="cost">cost</option>
          </select>
        </label>
        <label>
          {t("byodFactor")}
          <select
            value={factor}
            data-testid="byod-factor"
            onChange={(e) => setFactor(e.target.value as (typeof FACTORS)[number])}
          >
            {FACTORS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          CSV
          <input
            type="file"
            accept=".csv,text/csv"
            data-testid="byod-file"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </form>

      {error ? (
        <p className="error" role="alert" data-testid="byod-error">
          {error}
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="warnings" data-testid="byod-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <h2>{t("byodLoaded")}</h2>
      {vars.length === 0 ? (
        <p className="muted" data-testid="byod-empty">
          {t("byodEmpty")}
        </p>
      ) : (
        <ul data-testid="byod-list">
          {vars.map((v) => (
            <li key={v.id} data-byod-id={v.id}>
              <code>{v.id}</code> · {v.factor} · {v.direction} · n={v.rows.length}{" "}
              <button
                type="button"
                data-testid={`byod-remove-${v.id}`}
                onClick={() => {
                  removeByodVariable(v.id);
                  refresh();
                }}
              >
                {t("byodRemove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {vars.length > 0 ? (
        <button
          type="button"
          data-testid="byod-clear"
          onClick={() => {
            clearByodVariables();
            refresh();
          }}
        >
          {t("byodClear")}
        </button>
      ) : null}
    </PageShell>
  );
}
