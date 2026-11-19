import { expect, test } from "@playwright/test";

function encodeConfig(config: object): string {
  return Buffer.from(JSON.stringify(config), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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
});
