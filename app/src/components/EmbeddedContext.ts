import { createContext, useContext } from "react";

/** True while a page renders as a tab panel of "Fuentes y datos" (no own h1 / sub-nav). */
export const EmbeddedPanelContext = createContext(false);

export function useEmbeddedPanel(): boolean {
  return useContext(EmbeddedPanelContext);
}
