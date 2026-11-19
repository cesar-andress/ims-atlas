import { createContext, useContext } from "react";
import type { DocsSectionId } from "./docsSections";

export type HelpApi = {
  section: DocsSectionId | null;
  openHelp: (section: DocsSectionId) => void;
  closeHelp: () => void;
};

export const HelpContext = createContext<HelpApi | null>(null);

export function useHelp(): HelpApi {
  const ctx = useContext(HelpContext);
  if (!ctx) {
    throw new Error("useHelp requires HelpProvider");
  }
  return ctx;
}
