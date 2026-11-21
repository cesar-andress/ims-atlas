import { describe, expect, it } from "vitest";
import {
  ALL_HS_PRODUCTS,
  HS2_PRODUCTS,
  HS_NOMENCLATURE_COUNTS,
  hsCategoryTree,
  hsLabel,
  searchHs,
  tradeYearOptions,
} from "./hsProducts";

describe("HS nomenclature catalogue", () => {
  it("ships a complete HS2 chapter set (~96, not a demo subset)", () => {
    expect(HS2_PRODUCTS.length).toBeGreaterThanOrEqual(90);
    expect(HS_NOMENCLATURE_COUNTS.hs2).toBe(HS2_PRODUCTS.length);
    const codes = new Set(HS2_PRODUCTS.map((p) => p.code));
    expect(codes.has("01")).toBe(true);
    expect(codes.has("09")).toBe(true);
    expect(codes.has("64")).toBe(true);
    expect(codes.has("96")).toBe(true);
    // HS chapter 77 is reserved/empty in HS2012 BACI — must not invent it.
    expect(codes.has("77")).toBe(false);
  });

  it("includes HS4 and HS6 leaves from BACI product_codes", () => {
    expect(HS_NOMENCLATURE_COUNTS.hs4).toBeGreaterThan(1000);
    expect(HS_NOMENCLATURE_COUNTS.hs6).toBeGreaterThan(5000);
    expect(ALL_HS_PRODUCTS.length).toBe(
      HS_NOMENCLATURE_COUNTS.hs2 +
        HS_NOMENCLATURE_COUNTS.hs4 +
        HS_NOMENCLATURE_COUNTS.hs6,
    );
  });

  it("search finds footwear and coffee without truncating the catalogue source", () => {
    const footwear = searchHs("64", "es", { limit: 20 });
    expect(footwear.some((p) => p.code === "64")).toBe(true);
    expect(footwear.some((p) => p.code.startsWith("64"))).toBe(true);

    const coffee = searchHs("café", "es", { limit: 20 });
    expect(coffee.some((p) => p.code === "09" || p.code.startsWith("09"))).toBe(
      true,
    );

    const leather = searchHs("6403", "en", { limit: 20 });
    expect(leather.some((p) => p.code === "6403")).toBe(true);
  });

  it("empty search returns HS2 chapters only (no wall-of-text dump)", () => {
    const empty = searchHs("", "es", { emptyMeans: "hs2", limit: 200 });
    expect(empty.length).toBe(HS2_PRODUCTS.length);
    expect(empty.every((p) => p.code.length === 2)).toBe(true);
    expect(searchHs("", "es", { emptyMeans: "none" })).toEqual([]);
  });

  it("category tree has all HS2 parents", () => {
    const tree = hsCategoryTree();
    expect(tree.length).toBe(HS2_PRODUCTS.length);
    const footwear = tree.find((n) => n.code === "64");
    expect(footwear?.children.some((c) => c.code === "6403")).toBe(true);
  });

  it("labels resolve curated Spanish for common chapters", () => {
    expect(hsLabel("64", "es")).toMatch(/Calzado/i);
    expect(hsLabel("09", "es")).toMatch(/Café/i);
  });

  it("trade year options cover BACI pin range descending", () => {
    const years = tradeYearOptions();
    expect(years[0]).toBe(2024);
    expect(years[years.length - 1]).toBe(2012);
    expect(years).toContain(2020);
  });
});
