import { useEffect, useMemo, useState } from "react";
import {
  hsCategoryTree,
  hsLabel,
  searchHs,
  topImporterHints,
} from "../data/hsProducts";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { CountryPicker } from "./CountryPicker";

/**
 * Origin, product (HS) and year pickers. They live only in the project bar
 * dialog: this is the single place where the project scope is edited.
 */
export function ProjectScopeFields() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const [hsQuery, setHsQuery] = useState(config.hs ?? "");
  const [hsDraft, setHsDraft] = useState(config.hs ?? "");
  const [yearDraft, setYearDraft] = useState(
    config.year !== undefined ? String(config.year) : "",
  );

  // Keep local drafts in sync when a permalink or another editor changes config.
  useEffect(() => {
    setHsQuery(config.hs ?? "");
    setHsDraft(config.hs ?? "");
  }, [config.hs]);
  useEffect(() => {
    setYearDraft(config.year !== undefined ? String(config.year) : "");
  }, [config.year]);

  const hsHits = useMemo(() => searchHs(hsQuery, lang), [hsQuery, lang]);
  const importerHintIsos = useMemo(() => {
    const code = config.hs ?? hsQuery.trim();
    if (!code) return [];
    return topImporterHints(code);
  }, [config.hs, hsQuery]);
  const hsTree = useMemo(() => hsCategoryTree(), []);

  function pickHs(code: string) {
    setConfig({ hs: code });
    setHsQuery(code);
    setHsDraft(code);
  }

  return (
    <div className="scope-fields" data-testid="project-scope-fields">
      <CountryPicker
        value={config.origin ?? ""}
        testId="origin-picker"
        inputTestId="origin-input"
        hitsTestId="origin-hits"
        onChange={(iso) => setConfig({ origin: iso })}
      />

      <label>
        {t("product")}
        <input
          value={hsQuery}
          placeholder="64 / Footwear / 6403"
          data-testid="hs-search"
          onChange={(e) => setHsQuery(e.target.value)}
        />
      </label>
      {hsHits.length > 0 ? (
        <ul className="hs-hits" data-testid="hs-hits">
          {hsHits.slice(0, 10).map((p) => (
            <li key={p.code}>
              <button
                type="button"
                className={config.hs === p.code ? "active" : undefined}
                onClick={() => pickHs(p.code)}
              >
                {hsLabel(p.code, lang)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {importerHintIsos.length > 0 ? (
        <p className="muted small" data-testid="hs-importer-hints">
          {t("illustrativeImporters").replaceAll("{list}", importerHintIsos.join(", "))}
        </p>
      ) : null}
      <details className="hs-tree" data-testid="hs-category-tree">
        <summary>{t("hsCategoryTree")}</summary>
        <ul>
          {hsTree.map((node) => (
            <li key={node.code}>
              <button type="button" onClick={() => pickHs(node.code)}>
                {node.code} — {node.name[lang]}
              </button>
              {node.children.length > 0 ? (
                <ul>
                  {node.children.map((ch) => (
                    <li key={ch.code}>
                      <button type="button" onClick={() => pickHs(ch.code)}>
                        {ch.code} — {ch.name[lang]}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
      <label>
        HS2/HS4/HS6
        <input
          value={hsDraft}
          maxLength={6}
          data-testid="hs-input"
          onChange={(e) => setHsDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onBlur={() => {
            setConfig({ hs: hsDraft || undefined });
            setHsQuery(hsDraft);
          }}
        />
      </label>

      <label>
        {t("year")}
        <input
          type="number"
          value={yearDraft}
          placeholder=""
          data-testid="year-input"
          onChange={(e) => setYearDraft(e.target.value)}
          onBlur={() =>
            setConfig({
              year: yearDraft ? Number(yearDraft) : undefined,
            })
          }
        />
      </label>
    </div>
  );
}
