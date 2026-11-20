import type { ViewId } from "../state/schema";

/** Docs section anchors (Phase N). Keep in sync with Docs.tsx + locales. */
export const DOCS_SECTIONS = [
  "getting_started",
  "non_experts",
  "researchers",
  "imsfe_workflow",
  "projects",
  "methods",
  "why_normalize",
  "glossary",
  "tutorials",
  "sources",
  "cite",
  "faq",
] as const;

export type DocsSectionId = (typeof DOCS_SECTIONS)[number];

/** Map workspace views to the docs section opened by "?". */
export const VIEW_HELP_SECTION: Partial<Record<ViewId, DocsSectionId>> = {
  home: "getting_started",
  datos: "sources",
  variables: "non_experts",
  analisis: "non_experts",
  builder: "getting_started",
  catalog: "sources",
  ranking: "non_experts",
  matrix: "non_experts",
  map: "non_experts",
  compare: "non_experts",
  factors: "methods",
  uncertainty: "researchers",
  backtest: "researchers",
  time: "researchers",
  cite: "cite",
  byod: "faq",
  docs: "getting_started",
  norm_lab: "why_normalize",
  projects: "projects",
  project_variables: "projects",
  project_coverage: "projects",
  project_dashboard: "projects",
  explore: "getting_started",
  explore_analysis: "getting_started",
  country: "getting_started",
  sql: "researchers",
  paper: "researchers",
  changelog: "faq",
  status: "sources",
  data_sources: "sources",
  data_variable: "sources",
  data_pipeline: "sources",
  data_releases: "sources",
  data_updates: "sources",
};

export function isDocsSectionId(id: string): id is DocsSectionId {
  return (DOCS_SECTIONS as readonly string[]).includes(id);
}
