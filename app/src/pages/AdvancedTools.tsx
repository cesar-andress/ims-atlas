import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { useTranslation } from "../i18n";
import type { ViewId } from "../state/schema";

const TOOLS: { view: ViewId; titleKey: string; bodyKey: string }[] = [
  { view: "design", titleKey: "nav.design", bodyKey: "advancedToolDesign" },
  { view: "norm_lab", titleKey: "nav.norm_lab", bodyKey: "advancedToolNormLab" },
  { view: "sql", titleKey: "nav.sql", bodyKey: "advancedToolSql" },
  {
    view: "imsfe_import",
    titleKey: "nav.imsfe_import",
    bodyKey: "advancedToolImsfeImport",
  },
  { view: "ai_verify", titleKey: "nav.ai_verify", bodyKey: "advancedToolAiVerify" },
  { view: "paper", titleKey: "nav.paper", bodyKey: "advancedToolPaper" },
  { view: "catalog", titleKey: "nav.catalog", bodyKey: "advancedToolCatalog" },
  { view: "status", titleKey: "nav.status", bodyKey: "advancedToolStatus" },
  {
    view: "data_pipeline",
    titleKey: "nav.data_pipeline",
    bodyKey: "advancedToolPipeline",
  },
  {
    view: "data_releases",
    titleKey: "nav.data_releases",
    bodyKey: "advancedToolReleases",
  },
];

/** Internal labs and transparency tools — not in the top “Más” list (R2). */
export function AdvancedTools() {
  const { t } = useTranslation();
  return (
    <PageShell testId="advanced-tools" titleKey="nav.advanced_tools">
      <p className="muted">{t("advancedToolsIntro")}</p>
      <ul className="mt-4 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-0">
        {TOOLS.map((tool) => (
          <li
            key={tool.view}
            className="rounded-card border border-border bg-surface p-4"
          >
            <h2 className="m-0 text-base font-semibold text-ink">{t(tool.titleKey)}</h2>
            <p className="m-0 mt-1 text-sm text-ink-2">{t(tool.bodyKey)}</p>
            <PermalinkLink
              view={tool.view}
              className="btn btn-secondary mt-3 inline-flex"
              data-testid={`advanced-tool-${tool.view}`}
            >
              {t("studyOpen")}
            </PermalinkLink>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
