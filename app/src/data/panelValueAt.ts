import type { DemoPanel } from "../ranking/demoPanel";

export type PanelValueHit = {
  variableId: string;
  value: number;
  /** Panel notes may mention LOCF; year comes from project year. */
  sourceHint: string;
};

/** Read one panel cell for an ISO3 candidate; null when missing. */
export function panelValueAt(
  panel: DemoPanel | null | undefined,
  iso3: string | undefined,
  variableId: string,
): PanelValueHit | null {
  if (!panel || !iso3) return null;
  const row = panel.candidates.indexOf(iso3.toUpperCase());
  if (row < 0) return null;
  const col = panel.variables.findIndex((v) => v.id === variableId);
  if (col < 0) return null;
  const raw = panel.values[row]?.[col];
  if (raw == null || !Number.isFinite(raw)) return null;
  return {
    variableId,
    value: raw,
    sourceHint: `panel ${variableId} · ${panel.origin} · HS ${panel.hs} · ${panel.year}`,
  };
}
