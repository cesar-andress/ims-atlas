import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  HS2_PRODUCTS,
  HS_NOMENCLATURE_COUNTS,
  ensureFullHsNomenclature,
  getAllHsProducts,
  getHs4Products,
  getHs6Products,
  hsCategoryTree,
  hsLabel,
  hydrateHsNomenclature,
  isFullHsNomenclatureReady,
  resetHsNomenclatureForTests,
  searchHs,
  clampTradeYear,
  tradeYearOptions,
  HS_TRADE_YEAR_MAX,
  HS_TRADE_YEAR_MIN,
} from "./hsProducts";

const fullPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/meta/hs_nomenclature.json",
);

beforeAll(() => {
  const data = JSON.parse(readFileSync(fullPath, "utf8"));
  hydrateHsNomenclature(data);
});

describe("HS nomenclature catalogue", () => {
  it("ships HS2 in the SPA and full counts in meta JSON", () => {
    expect(HS2_PRODUCTS.length).toBeGreaterThanOrEqual(90);
    expect(HS_NOMENCLATURE_COUNTS.hs2).toBe(HS2_PRODUCTS.length);
    const codes = new Set(HS2_PRODUCTS.map((p) => p.code));
    expect(codes.has("01")).toBe(true);
    expect(codes.has("09")).toBe(true);
    expect(codes.has("64")).toBe(true);
    expect(codes.has("96")).toBe(true);
    expect(codes.has("77")).toBe(false);
    expect(isFullHsNomenclatureReady()).toBe(true);
    expect(HS_NOMENCLATURE_COUNTS.hs4).toBe(getHs4Products().length);
    expect(HS_NOMENCLATURE_COUNTS.hs6).toBe(getHs6Products().length);
  });

  it("includes HS4 and HS6 leaves from BACI product_codes", () => {
    expect(HS_NOMENCLATURE_COUNTS.hs4).toBeGreaterThan(1000);
    expect(HS_NOMENCLATURE_COUNTS.hs6).toBeGreaterThan(5000);
    expect(getAllHsProducts().length).toBe(
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

  it("clamps obsolete years (2025/2026) into the BACI pin window", () => {
    expect(clampTradeYear(2026)).toBe(HS_TRADE_YEAR_MAX);
    expect(clampTradeYear(2010)).toBe(HS_TRADE_YEAR_MIN);
    expect(clampTradeYear(2020)).toBe(2020);
  });

  it("ensureFullHsNomenclature is idempotent after hydrate", async () => {
    await ensureFullHsNomenclature();
    expect(isFullHsNomenclatureReady()).toBe(true);
  });

  it("without hydrate, search stays on HS2 until full load", () => {
    resetHsNomenclatureForTests();
    expect(isFullHsNomenclatureReady()).toBe(false);
    expect(
      searchHs("6403", "en", { limit: 5 }).every((p) => p.code.length === 2),
    ).toBe(true);
    hydrateHsNomenclature(JSON.parse(readFileSync(fullPath, "utf8")));
  });
});
