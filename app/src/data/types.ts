export type DataStatus = "idle" | "loading" | "ready" | "error";

export type CountryYearRow = {
  iso3: string;
  year: number;
  variable_id: string;
  value: number | null;
  flag_imputed: boolean;
  flag_locf: boolean;
};

export type CatalogCoverageStats = {
  n_countries?: number | undefined;
  year_min?: number | undefined;
  year_max?: number | undefined;
  coverage_pct?: number | undefined;
};

export type CatalogVariable = {
  id: string;
  name: { en: string; es: string } | string;
  factor: string;
  direction?: string | undefined;
  status?: string | undefined;
  redistributable?: boolean | undefined;
  source_ids: string[];
  licence_ids: string[];
  years?: number[] | undefined;
  citation?: string | undefined;
  notes?: string | undefined;
  gate_decision?: string | undefined;
  audience_public?: boolean | undefined;
  /** EXTRA-10: same series as another catalog id (do not double-weight). */
  alias_of?: string | undefined;
  coverage_stats?: CatalogCoverageStats | undefined;
  /** @deprecated retired demo grid — prefer coverage_stats */
  coverage_demo?: Record<string, Record<string, number | null>> | undefined;
};

export type CatalogPreview = {
  schema: string;
  factors: string[];
  variables: CatalogVariable[];
  n_variables: number;
  note?: string | undefined;
};

export type QueryResult<T> = {
  rows: T[];
  status: DataStatus;
  error?: string | undefined;
};
