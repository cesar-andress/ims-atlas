import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import { PageShell } from "../components/PageShell";
import { listByodVariables } from "../byod/byodStore";
import {
  apaCitation,
  bibtexCitation,
  pythonReproduceSnippet,
  risCitation,
  DATA_DOI,
  SOFTWARE_DOI,
} from "../cite/citations";
import { hashConfig } from "../cite/configHash";
import { downloadText, rankingToCsv } from "../cite/exportDownload";
import { useRankingModel } from "../ranking/useRankingModel";
import { useAnalysis } from "../state/useAnalysis";
import { configToSearch, pathForView } from "../state/urlState";
import { isAnalysisReady } from "../state/views";
import { version as APP_VERSION } from "@ims-atlas/core";
import { dataConfig } from "../dataConfig";

export function CiteExport() {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const ready = isAnalysisReady(config);
  const { model, error } = useRankingModel();
  const [hash, setHash] = useState<string>("");
  const byodIds = listByodVariables().map((v) => v.id);

  const permalink =
    typeof window !== "undefined"
      ? `${window.location.origin}${pathForView("cite")}${configToSearch({ ...config, view: "cite" })}`
      : pathForView("cite") + configToSearch({ ...config, view: "cite" });

  useEffect(() => {
    let cancelled = false;
    void hashConfig(config).then((h) => {
      if (!cancelled) setHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  const citeInput = useMemo(
    () => ({
      configHash: hash || "…",
      origin: config.origin,
      hs: config.hs,
      year: config.year,
      permalink,
      byodVariableIds: byodIds,
      softwareVersion: APP_VERSION,
    }),
    [hash, config.origin, config.hs, config.year, permalink, byodIds],
  );

  const apa = apaCitation(citeInput);
  const bib = bibtexCitation(citeInput);
  const ris = risCitation(citeInput);
  const py = pythonReproduceSnippet(citeInput);

  if (!ready) {
    return (
      <PageShell testId="cite-view" titleKey="nav.cite">
        <p className="muted">{t("analysisNeedConfig")}</p>
      </PageShell>
    );
  }

  return (
    <AnalysisPage
      testId="cite-view"
      titleKey="nav.cite"
      intro={t("citeIntro")}
      model={model}
      error={error}
    >
      {(m) => (
        <div data-testid="cite-body">
          <p className="muted small" data-testid="cite-versions">
            {t("appVersion")} {APP_VERSION} · {t("dataRelease")} v
            {dataConfig.release_version}
          </p>
          <p className="muted small" data-testid="doi-placeholders">
            {t("doiPending")}: software={SOFTWARE_DOI}; data={DATA_DOI}
          </p>
          <p data-testid="config-hash">
            {t("configHash")}: <code>{hash || "…"}</code>
          </p>
          <p data-testid="cite-permalink">
            Permalink:{" "}
            <a href={permalink} data-testid="cite-permalink-link">
              {permalink}
            </a>
          </p>
          {byodIds.length > 0 ? (
            <p data-testid="cite-byod-flag">
              {t("byodInCitation")}: {byodIds.join(", ")}
            </p>
          ) : null}

          <h2>APA</h2>
          <pre data-testid="cite-apa">{apa}</pre>
          <button
            type="button"
            onClick={() => downloadText("ims-atlas-cite.apa.txt", apa, "text/plain")}
          >
            {t("download")} APA
          </button>

          <h2>BibTeX</h2>
          <pre data-testid="cite-bibtex">{bib}</pre>
          <button
            type="button"
            onClick={() =>
              downloadText("ims-atlas-cite.bib", bib, "application/x-bibtex")
            }
          >
            {t("download")} BibTeX
          </button>

          <h2>RIS</h2>
          <pre data-testid="cite-ris">{ris}</pre>
          <button
            type="button"
            onClick={() =>
              downloadText(
                "ims-atlas-cite.ris",
                ris,
                "application/x-research-info-systems",
              )
            }
          >
            {t("download")} RIS
          </button>

          <h2>{t("exports")}</h2>
          <div className="matrix-controls">
            <button
              type="button"
              data-testid="export-ranking-csv"
              onClick={() =>
                downloadText(
                  "ims-atlas-ranking.csv",
                  rankingToCsv(m.ranking),
                  "text/csv",
                )
              }
            >
              CSV ranking
            </button>
            <button
              type="button"
              data-testid="export-config-json"
              onClick={() =>
                downloadText(
                  "ims-atlas-config.json",
                  JSON.stringify(
                    { config, configHash: hash, byodVariableIds: byodIds },
                    null,
                    2,
                  ) + "\n",
                  "application/json",
                )
              }
            >
              JSON config
            </button>
            <button
              type="button"
              data-testid="export-python"
              onClick={() =>
                downloadText("ims-atlas-reproduce.py", py, "text/x-python")
              }
            >
              Python snippet
            </button>
          </div>
          <pre data-testid="cite-python" className="small">
            {py}
          </pre>
        </div>
      )}
    </AnalysisPage>
  );
}
