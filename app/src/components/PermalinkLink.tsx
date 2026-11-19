import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAnalysis } from "../state/useAnalysis";
import type { AnalysisConfig, ViewId } from "../state/schema";
import { configToSearch, pathForView } from "../state/urlState";

type Props = {
  view: ViewId;
  /** Replace base config (e.g. demo preset) instead of merging the current one. */
  replace?: AnalysisConfig | undefined;
  patch?: Partial<AnalysisConfig> | undefined;
  className?: string | undefined;
  children: ReactNode;
  "data-testid"?: string | undefined;
  onMouseEnter?: (() => void) | undefined;
};

/** Single way to navigate while keeping (or replacing) analysis permalink state. */
export function PermalinkLink({
  view,
  replace,
  patch,
  className,
  children,
  onMouseEnter,
  "data-testid": testId,
}: Props) {
  const { config } = useAnalysis();
  const next: AnalysisConfig = {
    ...(replace ?? config),
    ...patch,
    view,
    v: 1,
  };
  return (
    <Link
      to={{
        pathname: pathForView(view, next.focusVariable),
        search: configToSearch(next),
      }}
      className={className}
      data-testid={testId}
      onMouseEnter={onMouseEnter}
    >
      {children}
    </Link>
  );
}
