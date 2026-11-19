import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const base = {
  v: 1 as const,
  origin: "COL",
  year: 2023,
  hs: "64",
  normalization: "minmax" as const,
  mcdm: "wsm" as const,
  weightScheme: "expert_mean" as const,
  missingThreshold: 0.2,
  lang: "en" as const,
};

test.describe("Phase 9 matrix + market map", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("strategic matrix shows quadrants for COL HS64", async ({ page }) => {
    await page.goto(
      `/matrix?c=${encodeConfig({ ...base, view: "matrix", matrixCutoff: "median" })}`,
    );
    await expect(page.getByTestId("matrix-view")).toBeVisible();
    await expect(page.getByTestId("strategic-scatter")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("matrix-table")).toBeVisible();
    await expect(page.locator("tr[data-quadrant]").first()).toBeVisible();
    await expect(page.getByTestId("matrix-cuts")).toContainText("cut A=");
  });

  test("market map layout is deterministic for seed", async ({ page }) => {
    await page.goto(
      `/map?c=${encodeConfig({
        ...base,
        view: "map",
        clusterK: 4,
        mapSeed: 42,
        mapColor: "cluster",
      })}`,
    );
    await expect(page.getByTestId("map-view")).toBeVisible();
    await expect(page.getByTestId("market-map-canvas")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("map-stress")).toContainText("SMACOF stress");
    const stress1 = await page.getByTestId("map-stress").innerText();
    await page.reload();
    await expect(page.getByTestId("market-map-canvas")).toBeVisible({
      timeout: 20_000,
    });
    const stress2 = await page.getByTestId("map-stress").innerText();
    expect(stress2).toBe(stress1);
    await expect(page.getByTestId("export-map-png")).toBeVisible();
    await expect(page.getByTestId("export-map-svg")).toBeVisible();
  });

  test("analysis tabs keep permalink when switching ranking → matrix → map", async ({
    page,
  }) => {
    await page.goto(
      `/ranking?c=${encodeConfig({ ...base, view: "ranking", compareA: "POL" })}`,
    );
    await expect(page.getByTestId("ranking-view")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/c=/);
    await expect(page.getByTestId("analysis-tabs")).toBeVisible();

    await page
      .getByTestId("analysis-tabs")
      .getByRole("link", { name: /matrix/i })
      .click();
    await expect(page.getByTestId("matrix-view")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/matrix\?c=/);

    await page.getByTestId("analysis-tabs").getByRole("link", { name: /map/i }).click();
    await expect(page.getByTestId("map-view")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/map\?c=/);

    await page.reload();
    await expect(page.getByTestId("map-view")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/map\?c=/);
  });
});
