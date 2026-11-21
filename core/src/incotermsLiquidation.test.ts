import { describe, expect, it } from "vitest";
import {
  JOSE_CORRECTED_DDP_TOTAL,
  JOSE_DEFAULT_INPUT,
  JOSE_EXCEL_DDP_TOTAL,
  JOSE_EXCEL_EXW_TOTAL,
  liquidateIncoterms,
} from "./incotermsLiquidation.js";

describe("liquidateIncoterms — Jose Excel case", () => {
  it("matches EXW 352.800 and DDP 399.906 in excel mode", () => {
    const rows = liquidateIncoterms({ ...JOSE_DEFAULT_INPUT, mode: "excel" });
    const exw = rows.find((r) => r.key === "EXW");
    const ddp = rows.find((r) => r.key === "DDP");
    expect(exw?.totalEur).toBe(JOSE_EXCEL_EXW_TOTAL);
    expect(ddp?.totalEur).toBe(JOSE_EXCEL_DDP_TOTAL);
    expect(Math.abs((exw?.totalEur ?? 0) - 352_800)).toBeLessThan(0.5);
    expect(Math.abs((ddp?.totalEur ?? 0) - 399_906)).toBeLessThan(0.5);
  });

  it("matches EXW 352.800 and corrected DDP 399.527 (FOB duty base)", () => {
    const rows = liquidateIncoterms({
      ...JOSE_DEFAULT_INPUT,
      mode: "corrected",
      dutyBase: "fob",
      vatRate: 0,
    });
    const exw = rows.find((r) => r.key === "EXW");
    const ddp = rows.find((r) => r.key === "DDP");
    expect(exw?.totalEur).toBe(JOSE_EXCEL_EXW_TOTAL);
    expect(ddp?.totalEur).toBe(JOSE_CORRECTED_DDP_TOTAL);
    expect(Math.abs((exw?.totalEur ?? 0) - 352_800)).toBeLessThan(0.5);
    expect(Math.abs((ddp?.totalEur ?? 0) - 399_527)).toBeLessThan(0.5);
    expect(ddp?.days).toBe(23);
  });

  it("keeps CIP above CIF in corrected mode", () => {
    const rows = liquidateIncoterms({
      ...JOSE_DEFAULT_INPUT,
      mode: "corrected",
      dutyBase: "fob",
    });
    const cif = rows.find((r) => r.key === "CIF")!.totalEur;
    const cip = rows.find((r) => r.key === "CIP")!.totalEur;
    expect(cip - cif).toBe(145);
  });
});
