import { afterEach, describe, expect, it, vi } from "vitest";
import { clampTradeYear, HS_TRADE_YEAR_MAX } from "../data/hsProducts";
import { DemoPanelPendingError } from "./demoPanel";
import { loadProjectPanel, resetProjectPanelCache } from "./projectPanel";

vi.mock("../data/catalogLoader", () => ({
  loadCatalogPreview: async () => ({
    variables: [
      {
        id: "IMPV",
        factor: "demand",
        direction: "benefit",
        status: "verified",
        redistributable: true,
        source_ids: ["baci"],
      },
      {
        id: "LPI",
        factor: "logistics",
        direction: "benefit",
        status: "verified",
        redistributable: true,
        source_ids: ["worldbank_lpi"],
      },
      {
        id: "GDPPC",
        factor: "macro_risk",
        direction: "benefit",
        status: "verified",
        redistributable: true,
        source_ids: ["worldbank_wdi"],
      },
      {
        id: "DIST",
        factor: "cost_access",
        direction: "cost",
        status: "verified",
        redistributable: true,
        source_ids: ["cepi_gravity"],
      },
      {
        id: "LANG",
        factor: "communication",
        direction: "benefit",
        status: "verified",
        redistributable: true,
        source_ids: ["cepi_gravity"],
      },
      {
        id: "FTA",
        factor: "openness",
        direction: "benefit",
        status: "verified",
        redistributable: true,
        source_ids: ["cepi_gravity"],
      },
      {
        id: "GOV",
        factor: "institutional",
        direction: "benefit",
        status: "verified",
        redistributable: true,
        source_ids: ["worldbank_wgi"],
      },
      {
        id: "CC",
        factor: "institutional",
        direction: "benefit",
        status: "verified",
        redistributable: true,
        source_ids: ["worldbank_wgi"],
      },
    ],
  }),
}));

vi.mock("../auth/accessConfig", () => ({
  loadAccessConfig: async () => ({
    auth: { cerrada_base_path: "/datos-cerrados" },
  }),
}));

const querySql = vi.fn();
const loadCountryProductChapter = vi.fn();
const loadRelease = vi.fn();
const init = vi.fn();

vi.mock("../data/duckdbClient", () => ({
  getAtlasDataClient: () => ({
    init,
    loadRelease,
    loadCountryProductChapter,
    querySql,
  }),
}));

function isoList(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `C${String(i).padStart(2, "0")}`);
}

describe("loadProjectPanel", () => {
  afterEach(() => {
    resetProjectPanelCache();
    vi.clearAllMocks();
  });

  it("rejects incomplete scope", async () => {
    await expect(loadProjectPanel({ origin: "ESP" })).rejects.toBeInstanceOf(
      DemoPanelPendingError,
    );
  });

  it("keeps analysis year 2026 and queries LOCF with yearMax=2026", async () => {
    expect(clampTradeYear(2026, { nowYear: 2026 })).toBe(2026);

    const markets = isoList(25);
    loadCountryProductChapter.mockResolvedValue(true);
    init.mockResolvedValue(undefined);
    loadRelease.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("manifest.json")) {
          return new Response(null, { status: 404 });
        }
        if (String(url).includes("CURRENT")) {
          return new Response("1.2.0", { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    querySql
      .mockResolvedValueOnce(
        markets.map((iso3) => ({
          iso3,
          variable_id: "IMPV",
          value: 1000,
          year: 2024,
        })),
      )
      .mockResolvedValueOnce(
        markets.flatMap((iso3) => [
          { iso3, variable_id: "LPI", value: 3.5, year: 2023 },
          { iso3, variable_id: "GDPPC", value: 20000, year: 2024 },
          { iso3, variable_id: "GOV", value: 0.5, year: 2022 },
          { iso3, variable_id: "CC", value: 0.4, year: 2022 },
        ]),
      )
      .mockResolvedValueOnce(
        markets.flatMap((iso3) => [
          // Must fall inside LOCF window for t=2026 (2021-2026).
          { iso3, variable_id: "DIST", value: 1000, year: 2022 },
          { iso3, variable_id: "LANG", value: 1, year: 2022 },
          { iso3, variable_id: "FTA", value: 1, year: 2022 },
        ]),
      );

    const panel = await loadProjectPanel({
      origin: "ESP",
      hs: "09",
      year: 2026,
    });

    expect(panel.year).toBe(2026);
    expect(panel.candidates.length).toBeGreaterThanOrEqual(20);
    expect(panel.variables.length).toBeGreaterThanOrEqual(6);
    const productSql = String(querySql.mock.calls[0]?.[0] ?? "");
    expect(productSql).toContain("year <= 2026");
    expect(productSql).toContain(`year >= ${2026 - 5}`);
    expect(loadCountryProductChapter).toHaveBeenCalled();
    const loadArgs = loadCountryProductChapter.mock.calls[0]?.[1] as
      { years?: number[] } | undefined;
    expect(loadArgs?.years).toContain(HS_TRADE_YEAR_MAX);
  });
});
