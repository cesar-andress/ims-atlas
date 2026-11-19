import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";

const PRODUCT_CASES = [
  { name: "HS87", origin: "DEU", hs: "87", year: 2022 },
  { name: "HS84", origin: "USA", hs: "84", year: 2022 },
  { name: "HS1509", origin: "ESP", hs: "1509", year: 2022 },
] as const;

function baseConfig(origin: string, hs: string, year: number) {
  return {
    v: 1,
    view: "ranking",
    origin,
    hs,
    year,
    normalization: "minmax",
    mcdm: "wsm",
    weightScheme: "expert_mean",
    missingThreshold: 0.2,
    lang: "en",
  };
}

test.describe("Phase H product context", () => {
  for (const { name, origin, hs, year } of PRODUCT_CASES) {
    test(`product banner for ${name}`, async ({ page }) => {
      const config = baseConfig(origin, hs, year);
      await page.goto(`/ranking?c=${encodeConfig(config)}`);
      await expect(page.getByTestId("ranking-view")).toBeVisible();
      const banner = page.getByTestId("product-context");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(origin);
      await expect(banner).toContainText(hs);
      await expect(banner).toContainText(String(year));
    });
  }

  test("apply-col-hs64 preset still works", async ({ page }) => {
    await page.goto("/builder");
    await expect(page.getByTestId("config-panel")).toBeVisible();
    await page.getByTestId("apply-col-hs64").click();
    const banner = page.getByTestId("product-context");
    await expect(banner).toContainText("COL");
    await expect(banner).toContainText("64");
    await expect(banner).toContainText("2023");
  });

  test("Factors does not crash for non-demo product", async ({ page }) => {
    const config = { ...baseConfig("ESP", "1509", 2022), view: "factors" as const };
    await page.goto(`/factors?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("factors-view")).toBeVisible();
    await expect(page.getByTestId("product-context")).toBeVisible();
    await expect(page.getByTestId("analysis-error")).toHaveCount(0);
  });
});
