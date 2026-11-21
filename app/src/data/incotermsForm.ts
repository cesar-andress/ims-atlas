/**
 * Project-aware Incoterms form → LiquidationInput.
 * Jose Excel case only via explicit preset (never the silent default).
 */

import {
  JOSE_COST_ITEMS,
  JOSE_DEFAULT_INPUT,
  type IncotermMode,
  type LiquidationInput,
} from "@ims-atlas/core";
import { intraEuDutyRate, projectFxRate } from "./euTradeContext";
import { vatRateForIso3 } from "./vatRatesResearch";

export type IncotermsPreset = "project" | "jose";

export type IncotermsFormState = {
  preset: IncotermsPreset;
  mode: IncotermMode;
  units: number | null;
  exwUnitEur: number | null;
  originPlace: string;
  destPlace: string;
  freightEur: number | null;
  insuranceEur: number | null;
  exportClearanceEur: number | null;
  importClearanceEur: number | null;
  unloadEur: number | null;
  dutyRate: number | null;
  vatRate: number | null;
  fxRate: number | null;
  delayDays: number;
  /** User-supplied €/day; never invent a default. */
  delayCostPerDayEur: number | null;
  dutySource?: string | undefined;
  vatSource?: string | undefined;
  fxSource?: string | undefined;
};

export type FieldSource = { label: string; source: string };

/** Zero Jose line items, then apply the short form overrides. */
function projectAmounts(form: IncotermsFormState): Record<string, number> {
  const amounts: Record<string, number> = {};
  for (const item of JOSE_COST_ITEMS) {
    amounts[item.id] = 0;
  }
  if (form.exportClearanceEur != null) amounts.agorig = form.exportClearanceEur;
  if (form.freightEur != null) amounts.tin = form.freightEur;
  if (form.insuranceEur != null) amounts.segtin = form.insuranceEur;
  if (form.unloadEur != null) amounts.descpdd = form.unloadEur;
  if (form.importClearanceEur != null) amounts.agdest = form.importClearanceEur;
  return amounts;
}

export function formToLiquidationInput(form: IncotermsFormState): LiquidationInput | null {
  if (form.preset === "jose") {
    return {
      ...JOSE_DEFAULT_INPUT,
      mode: form.mode,
      dutyBase: form.mode === "corrected" ? "fob" : "cif",
      vatRate: form.mode === "corrected" ? (form.vatRate ?? 0) : 0,
    };
  }
  if (form.units == null || form.units < 1) return null;
  if (form.exwUnitEur == null || !Number.isFinite(form.exwUnitEur)) return null;
  return {
    mode: form.mode,
    units: Math.trunc(form.units),
    exwUnitEur: form.exwUnitEur,
    dutyRate: Math.max(0, form.dutyRate ?? 0),
    vatRate: form.mode === "corrected" ? Math.max(0, form.vatRate ?? 0) : 0,
    dutyBase: form.mode === "corrected" ? "fob" : "cif",
    amounts: projectAmounts(form),
  };
}

export type ProjectPlaces = {
  originIso3?: string | undefined;
  targetIso3?: string | undefined;
  originLabel: string;
  destLabel: string;
};

/** Fresh project form: places + autofill duty/VAT/FX when known; costs empty. */
export function emptyProjectForm(
  places: ProjectPlaces,
  mode: IncotermMode = "corrected",
): IncotermsFormState {
  const duty = intraEuDutyRate(places.originIso3, places.targetIso3);
  const vat = vatRateForIso3(places.targetIso3);
  const fx = projectFxRate(places.originIso3, places.targetIso3);
  return {
    preset: "project",
    mode,
    units: null,
    exwUnitEur: null,
    originPlace: places.originLabel,
    destPlace: places.destLabel,
    freightEur: null,
    insuranceEur: null,
    exportClearanceEur: null,
    importClearanceEur: null,
    unloadEur: null,
    dutyRate: duty?.rate ?? null,
    vatRate: vat?.rate ?? null,
    fxRate: fx?.rate ?? null,
    delayDays: 0,
    delayCostPerDayEur: null,
    ...(duty ? { dutySource: duty.sourceNote } : {}),
    ...(vat ? { vatSource: `${vat.sourceNote} (${vat.year})` } : {}),
    ...(fx ? { fxSource: fx.sourceNote } : {}),
  };
}

/** Explicit Jose Tarragona–Miami preset. */
export function joseExampleForm(mode: IncotermMode = "excel"): IncotermsFormState {
  return {
    preset: "jose",
    mode,
    units: JOSE_DEFAULT_INPUT.units,
    exwUnitEur: JOSE_DEFAULT_INPUT.exwUnitEur,
    originPlace: "Tarragona (ESP)",
    destPlace: "Miami (USA)",
    freightEur: 3500,
    insuranceEur: 290,
    exportClearanceEur: 1100,
    importClearanceEur: 800,
    unloadEur: 200,
    dutyRate: JOSE_DEFAULT_INPUT.dutyRate,
    vatRate: 0,
    fxRate: null,
    delayDays: 0,
    delayCostPerDayEur: null,
    dutySource: "Ejemplo Jose (10 % sobre CIF/FOB según modo)",
    vatSource: undefined,
    fxSource: undefined,
  };
}

export function delayExtraEur(form: IncotermsFormState): number {
  if (form.delayDays <= 0) return 0;
  if (form.delayCostPerDayEur == null || form.delayCostPerDayEur < 0) return 0;
  return form.delayDays * form.delayCostPerDayEur;
}
