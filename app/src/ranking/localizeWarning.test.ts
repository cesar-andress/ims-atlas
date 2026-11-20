import { describe, expect, it } from "vitest";
import { localizeWarning } from "./localizeWarning";

describe("localizeWarning", () => {
  it("translates the demo-panel pre-selection warning to Spanish", () => {
    expect(
      localizeWarning(
        "Pre-selection uses demo-panel import proxies (BACI trade parquet not loaded).",
        "es",
      ),
    ).toBe(
      "La preselección usa importaciones aproximadas del ejemplo (datos de comercio BACI no cargados).",
    );
  });

  it("keeps dynamic values", () => {
    expect(localizeWarning("Median-imputed cells: 42", "es")).toBe(
      "Celdas rellenadas con la mediana: 42",
    );
    expect(localizeWarning("Excluded for missingness: LPI, GOV", "es")).toBe(
      "Excluidas por falta de datos: LPI, GOV",
    );
  });

  it("leaves English and unknown strings untouched", () => {
    const msg = "Median-imputed cells: 3";
    expect(localizeWarning(msg, "en")).toBe(msg);
    expect(localizeWarning("Something new", "es")).toBe("Something new");
  });

  it("translates weight/matrix mismatch errors", () => {
    expect(localizeWarning("No variables left after restricting weights", "es")).toMatch(
      /pesos manuales/i,
    );
    expect(
      localizeWarning("No overlapping factors between weights and matrix", "es"),
    ).toMatch(/factores/i);
  });
});
