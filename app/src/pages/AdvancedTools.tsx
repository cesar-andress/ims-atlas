import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { useTranslation } from "../i18n";
import type { ViewId } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";

type ToolLink = {
  view: ViewId;
  titleKey: string;
  bodyKey: string;
  hash?: string;
};

type ToolGroup = {
  titleKey: string;
  tools: ToolLink[];
};

const GROUPS: ToolGroup[] = [
  {
    titleKey: "advancedGroupData",
    tools: [
      {
        view: "data_sources",
        titleKey: "nav.data_sources",
        bodyKey: "advancedToolFuentes",
      },
      {
        view: "data_pipeline",
        titleKey: "nav.data_pipeline",
        bodyKey: "advancedToolPipeline",
      },
    ],
  },
  {
    titleKey: "advancedGroupMethod",
    tools: [
      {
        view: "norm_lab",
        titleKey: "nav.norm_lab",
        bodyKey: "advancedToolNormLab",
      },
      {
        view: "imsfe_import",
        titleKey: "nav.imsfe_import",
        bodyKey: "advancedToolImsfeImport",
      },
      {
        view: "ai_verify",
        titleKey: "nav.ai_verify",
        bodyKey: "advancedToolAiVerify",
      },
      {
        view: "paper",
        titleKey: "nav.paper",
        bodyKey: "advancedToolPaper",
      },
      {
        view: "byod",
        titleKey: "nav.byod",
        bodyKey: "advancedToolByod",
      },
    ],
  },
  {
    titleKey: "advancedGroupLabs",
    tools: [
      {
        view: "design",
        titleKey: "nav.design",
        bodyKey: "advancedToolDesign",
      },
      {
        view: "sql",
        titleKey: "nav.sql",
        bodyKey: "advancedToolSql",
      },
    ],
  },
];

/** Team-only tools hub: grouped links, no card grid. */
export function AdvancedTools() {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  return (
    <PageShell
      testId="advanced-tools"
      titleKey="nav.advanced_tools"
      className="team-tools"
    >
      <p className="lead team-tools-lead" data-testid="advanced-tools-intro">
        {t("advancedToolsIntro")}
      </p>
      <div className="team-tools-groups">
        {GROUPS.map((group) => (
          <section
            key={group.titleKey}
            className="team-tools-group"
            aria-labelledby={`team-tools-${group.titleKey}`}
          >
            <h2 id={`team-tools-${group.titleKey}`} className="team-tools-group-title">
              {t(group.titleKey)}
            </h2>
            <ul className="team-tools-list">
              {group.tools.map((tool) => {
                const current = config.view === tool.view;
                return (
                  <li key={`${tool.view}-${tool.hash ?? ""}`}>
                    <PermalinkLink
                      view={tool.view}
                      {...(tool.hash ? { hash: tool.hash } : {})}
                      className={
                        current ? "team-tools-link is-current" : "team-tools-link"
                      }
                      data-testid={`advanced-tool-${tool.view}`}
                      aria-current={current ? "page" : undefined}
                    >
                      <span className="team-tools-link-title">{t(tool.titleKey)}</span>
                      <span className="team-tools-link-body muted">
                        {t(tool.bodyKey)}
                      </span>
                    </PermalinkLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
