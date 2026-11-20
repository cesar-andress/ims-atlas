import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";
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

  test("Datos → Variables → Análisis → Ranking ≤ 6 clicks", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-flow-cards")).toBeVisible();
    await page.getByTestId("home-card-datos").click(); // 1
    await expect(page.getByTestId("datos-hub")).toBeVisible();
    await page
      .getByTestId("main-nav")
      .getByRole("link", { name: "Variables", exact: true })
      .click(); // 2
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("apply-col-hs64").click(); // 3
    await page
      .getByTestId("main-nav")
      .getByRole("link", { name: "Analysis", exact: true })
      .click(); // 4
    await expect(page.getByTestId("analisis-gallery")).toBeVisible();
    await expect(page.getByTestId("analisis-context")).toContainText("COL");
    await expect(page.getByTestId("study-open-ranking")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("study-open-ranking").click(); // 5
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("primary nav has exactly Datos Variables Análisis Projects", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByTestId("main-nav");
    await expect(nav.getByRole("link", { name: "Data", exact: true })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Variables", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Analysis", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Projects", exact: true }),
    ).toBeVisible();
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

  test("Variables guided chrome + summary; WeightLifter in Pesos step", async ({
    page,
  }) => {
    await page.goto(`/variables?c=${encodeConfig({ ...COL, view: "variables" })}`);
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("variables-summary-bar")).toBeVisible();
    await expect(page.getByTestId("variables-guided-chrome")).toBeVisible();
    await expect(page.getByTestId("origin-input")).toBeVisible();
    await page.getByTestId("guided-next").click();
    await page.getByTestId("guided-next").click();
    await page.getByTestId("guided-next").click();
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

  test("backtest card blocked for HS 6401", async ({ page }) => {
    await page.goto(
      `/analisis?c=${encodeConfig({ ...COL, hs: "6401", view: "analisis" })}`,
    );
    await expect(page.getByTestId("study-card-backtest")).toHaveAttribute(
      "data-available",
      "0",
    );
    await expect(page.getByTestId("study-blocked-backtest")).toContainText(
      /HS 64|artículo|paper/i,
    );
  });
});
