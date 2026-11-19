import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { DocsSectionId } from "./docsSections";
import { HelpContext } from "./helpContext";

export function HelpProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<DocsSectionId | null>(null);
  const openHelp = useCallback((id: DocsSectionId) => setSection(id), []);
  const closeHelp = useCallback(() => setSection(null), []);
  const value = useMemo(
    () => ({ section, openHelp, closeHelp }),
    [section, openHelp, closeHelp],
  );
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}
