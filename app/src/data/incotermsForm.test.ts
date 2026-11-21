import { describe, expect, it } from "vitest";
import {
  JOSE_EXCEL_DDP_TOTAL,
  JOSE_EXCEL_EXW_TOTAL,
  liquidateIncoterms,
} from "@ims-atlas/core";
import {
  delayExtraEur,
  emptyProjectForm,
  formToLiquidationInput,
  joseExampleForm,
} from "./incotermsForm";

describe("incotermsForm", () => {
  it("Jose preset reproduces Excel totals", () => {
    const form = joseExampleForm("excel");
    const input = formToLiquidationInput(form);
    expect(input).not.toBeNull();
    const rows = liquidateIncoterms(input!);
    expect(rows.find((r) => r.key === "EXW")?.totalEur).toBe(JOSE_EXCEL_EXW_TOTAL);
    expect(rows.find((r) => r.key === "DDP")?.totalEur).toBe(JOSE_EXCEL_DDP_TOTAL);
  });

  it("project ESP→DEU autofills duty 0, VAT 19%, FX 1", () => {
    const form = emptyProjectForm({
      originIso3: "ESP",
      targetIso3: "DEU",
      originLabel: "España",
      destLabel: "Alemania",
    });
    expect(form.preset).toBe("project");
    expect(form.dutyRate).toBe(0);
    expect(form.vatRate).toBeCloseTo(0.19, 9);
    expect(form.fxRate).toBe(1);
    expect(form.dutySource).toMatch(/Unión aduanera/);
    expect(form.vatSource).toMatch(/Bundesministerium/);
    expect(form.units).toBeNull();
  });

  it("project form without units does not liquidate", () => {
    const form = emptyProjectForm({
      originIso3: "ESP",
      targetIso3: "DEU",
      originLabel: "España",
      destLabel: "Alemania",
    });
    expect(formToLiquidationInput(form)).toBeNull();
  });

  it("delay cost uses only user €/day (never a hardcoded 75)", () => {
    const form = {
      ...joseExampleForm(),
      delayDays: 2,
      delayCostPerDayEur: null,
    };
    expect(delayExtraEur(form)).toBe(0);
    expect(delayExtraEur({ ...form, delayCostPerDayEur: 40 })).toBe(80);
  });
});
