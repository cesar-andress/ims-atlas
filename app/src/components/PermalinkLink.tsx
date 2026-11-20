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
  /** Optional URL hash (without #), e.g. docs-methods. */
  hash?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
  "data-testid"?: string | undefined;
  title?: string | undefined;
  "aria-current"?: "step" | "page" | undefined;
  "aria-label"?: string | undefined;
  onClick?: (() => void) | undefined;
  onMouseEnter?: (() => void) | undefined;
  onFocus?: (() => void) | undefined;
};

/** Single way to navigate while keeping (or replacing) analysis permalink state. */
export function PermalinkLink({
  view,
  replace,
  patch,
  hash,
  className,
  children,
  title,
  "aria-current": ariaCurrent,
  "aria-label": ariaLabel,
  onClick,
  onMouseEnter,
  onFocus,
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
        ...(hash ? { hash: hash.startsWith("#") ? hash : `#${hash}` } : {}),
      }}
      className={className}
      data-testid={testId}
      title={title}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
    >
      {children}
    </Link>
  );
}
