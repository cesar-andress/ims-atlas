import { expect, test } from "@playwright/test";
import { encodeConfig, openMoreOptions } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const COL = {
  v: 1 as const,
  origin: "COL",
  hs: "64",
  year: 2023,
  lang: "en" as const,
  normalization: "minmax" as const,
  mcdm: "wsm" as const,
  weightScheme: "expert_mean" as const,
  missingThreshold: 0.2,
};

test.describe("Phase W/U/M GUI flow", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("design system page shows illustrative banner", async ({ page }) => {
    await page.goto(`/design?c=${encodeConfig({ ...COL, view: "design" })}`);
    await expect(page.getByTestId("design-system-view")).toBeVisible();
    await expect(page.getByTestId("design-illustrative-banner")).toBeVisible();
    await expect(page.getByTestId("design-criteria")).toBeVisible();
  });

  test("example project reaches the ranking in 2 clicks", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page.getByTestId("home-projects")).toBeVisible();
    await page.locator('[data-example="1"]').click(); // 1: open the example card
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("project-chips")).toContainText("Colombia");
    await page.getByTestId("results-tab-matrix").click(); // 2: any result tab
    await expect(page.getByTestId("matrix-view")).toBeVisible({ timeout: 20_000 });
  });

  test("header is one row: logo, project switcher, help, language, team login", async ({
    page,
  }) => {
    await page.goto("/inicio");
    const header = page.getByTestId("site-header");
    await expect(header).toBeVisible();
    await expect(page.getByTestId("project-switcher")).toBeVisible();
    await expect(page.getByTestId("help-open")).toBeVisible();
    await expect(page.getByTestId("lang-switch")).toBeVisible();
    await expect(page.getByTestId("access-login")).toBeVisible();
    await expect(page.getByTestId("main-nav")).toHaveCount(0);
    await expect(page.getByTestId("nav-more")).toHaveCount(0);
    await expect(page.getByTestId("project-bar")).toHaveCount(0);
  });

  test("/analisis offers the example and keeps results read-only", async ({ page }) => {
    await page.goto("/analisis");
    await expect(page.getByTestId("results-tabs")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("analysis-load-preset").click();
    await expect(page.getByTestId("project-chips")).toContainText("Colombia", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("map has choropleth legend + cluster how panel; 0 selects on map-results", async ({
    page,
  }) => {
    await page.goto(
      `/map?c=${encodeConfig({
        ...COL,
        view: "map",
        clusterK: 4,
        mapSeed: 42,
      })}`,
    );
    await expect(page.getByTestId("map-results")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("choropleth-legend")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("cluster-how")).toBeVisible({ timeout: 25_000 });
    const n = await page
      .getByTestId("map-results")
      .locator("input, select, textarea")
      .count();
    expect(n).toBe(0);
  });

  test("uncertainty shows quantile dots and top-k bars", async ({ page }) => {
    await page.goto(`/uncertainty?c=${encodeConfig({ ...COL, view: "uncertainty" })}`);
    await expect(page.getByTestId("uncertainty-body")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("topk-prob-bars")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("quantile-dot-plot")).toBeVisible();
    await expect(page.getByTestId("hop-ranking")).toBeVisible({ timeout: 25_000 });
  });

  test("Variables y pesos: criterion cards; method controls under Más opciones", async ({
    page,
  }) => {
    await page.goto(`/variables?c=${encodeConfig({ ...COL, view: "variables" })}`);
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("project-chips")).toBeVisible();
    await expect(page.getByTestId("criterion-weights")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("variables-expert-toggle")).toHaveCount(0);
    await expect(page.getByTestId("origin-input")).toHaveCount(0);
    await openMoreOptions(page);
    await expect(page.getByTestId("weight-scheme")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("weightlifter-panel")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("podium-panel")).toBeVisible();
    await expect(page.getByTestId("strategy-presets")).toBeVisible();
  });

  test("map cluster descriptors list is present", async ({ page }) => {
    await page.goto(
      `/map?c=${encodeConfig({
        ...COL,
        view: "map",
        clusterK: 4,
        mapSeed: 42,
      })}`,
    );
    await expect(page.getByTestId("cluster-descriptors")).toBeVisible({
      timeout: 25_000,
    });
  });

  test("Results tabs reach the backtest blocked state for HS 6401", async ({
    page,
  }) => {
    await page.goto(
      `/analisis?c=${encodeConfig({ ...COL, hs: "6401", view: "analisis" })}`,
    );
    await expect(page.getByTestId("results-tabs")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("results-tab-backtest").click();
    await expect(page.getByTestId("backtest-blocked")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("backtest deep-link blocked for non-paper config", async ({ page }) => {
    await page.goto(
      `/backtest?c=${encodeConfig({ ...COL, hs: "6401", view: "backtest" })}`,
    );
    await expect(page.getByTestId("backtest-blocked")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("backtest-body")).toHaveCount(0);
  });

  test("ValueCharts panel appears under Más opciones", async ({ page }) => {
    await page.goto(`/variables?c=${encodeConfig({ ...COL, view: "variables" })}`);
    await openMoreOptions(page);
    await expect(page.getByTestId("valuecharts-panel")).toBeVisible({
      timeout: 20_000,
    });
  });
});
