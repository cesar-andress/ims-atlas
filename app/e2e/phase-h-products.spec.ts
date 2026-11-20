import { expect, test } from "@playwright/test";
import { encodeConfig, openMoreOptions, openScopeDialog } from "./_helpers";

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
    test(`project bar shows scope for ${name}`, async ({ page }) => {
      const config = baseConfig(origin, hs, year);
      await page.goto(`/ranking?c=${encodeConfig(config)}`);
      await expect(page.getByTestId("ranking-view")).toBeVisible();
      const chips = page.getByTestId("project-chips");
      await expect(chips).toBeVisible();
      await expect(page.getByTestId("chip-origin")).toBeVisible();
      await expect(page.getByTestId("chip-product")).toContainText(hs);
      await expect(page.getByTestId("chip-year")).toContainText(String(year));
      await openScopeDialog(page, "origin");
      await expect(page.getByTestId("origin-input")).toHaveValue(origin);
    });
  }

  test("apply-col-hs64 example still works", async ({ page }) => {
    await page.goto("/variables");
    await openMoreOptions(page);
    await page.getByTestId("apply-col-hs64").click();
    await openScopeDialog(page, "origin");
    await expect(page.getByTestId("origin-input")).toHaveValue("COL");
    await expect(page.getByTestId("hs-input")).toHaveValue("64");
    await expect(page.getByTestId("year-input")).toHaveValue("2023");
  });

  test("Factors does not crash for non-demo product", async ({ page }) => {
    const config = { ...baseConfig("ESP", "1509", 2022), view: "factors" as const };
    await page.goto(`/factors?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("factors-view")).toBeVisible();
    await expect(page.getByTestId("chip-product")).toContainText("1509");
    await expect(page.getByTestId("analysis-error")).toHaveCount(0);
  });
});
