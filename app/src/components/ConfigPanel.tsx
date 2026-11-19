import { useTranslation } from "react-i18next";
import { useAnalysis } from "../state/useAnalysis";

export function ConfigPanel() {
  const { t } = useTranslation();
  const { config, setConfig, saveProject, exportProject, importProject } =
    useAnalysis();

  return (
    <aside
      className="config-panel"
      data-testid="config-panel"
      aria-label={t("configPanel")}
    >
      <h2>{t("configPanel")}</h2>
      <label>
        {t("origin")}
        <input
          value={config.origin ?? ""}
          maxLength={3}
          placeholder="COL"
          onChange={(e) =>
            setConfig({
              origin: e.target.value
                ? e.target.value.toUpperCase().slice(0, 3)
                : undefined,
            })
          }
        />
      </label>
      <label>
        {t("year")}
        <input
          type="number"
          value={config.year ?? ""}
          placeholder="2019"
          onChange={(e) =>
            setConfig({
              year: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </label>
      <label>
        {t("normalization")}
        <select
          value={config.normalization ?? ""}
          onChange={(e) =>
            setConfig({
              normalization: e.target.value
                ? (e.target.value as typeof config.normalization)
                : undefined,
            })
          }
        >
          <option value="">—</option>
          <option value="minmax">minmax</option>
          <option value="ratio_legacy">ratio_legacy</option>
          <option value="zscore">zscore</option>
          <option value="rank">rank</option>
          <option value="log_minmax">log_minmax</option>
        </select>
      </label>
      <label>
        {t("method")}
        <select
          value={config.mcdm ?? ""}
          onChange={(e) =>
            setConfig({
              mcdm: e.target.value ? (e.target.value as typeof config.mcdm) : undefined,
            })
          }
        >
          <option value="">—</option>
          <option value="wsm">wsm</option>
          <option value="topsis">topsis</option>
          <option value="vikor">vikor</option>
          <option value="promethee_ii">promethee_ii</option>
        </select>
      </label>
      <div className="config-actions">
        <button type="button" onClick={() => saveProject("local")}>
          {t("saveProject")}
        </button>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([exportProject()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ims-atlas-project.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("exportProject")}
        </button>
        <label className="file-import">
          {t("importProject")}
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              importProject(text);
            }}
          />
        </label>
      </div>
    </aside>
  );
}
