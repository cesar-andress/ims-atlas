import { expect, test } from "@playwright/test";
import { encodeConfig, openMoreOptions } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const COL = {
  v: 1 as const,
  origin: "COL",
  year: 2023,
  hs: "64",
  lang: "en" as const,
};

test.describe("GUI remaining: tour, LineUp, compare, clicks", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
    await page.addInitScript(() => {
      localStorage.setItem("ims-atlas.first-visit-dismissed", "1");
    });
  });

  test("example project in 2 clicks, then the three steps", async ({ page }) => {
    await page.goto("/inicio");
    const example = page.locator('[data-example="1"]');
    await expect(example).toBeVisible({ timeout: 15_000 }); // click 1 target
    await example.click();
    await expect(page.getByTestId("results-shell")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("ranking-view")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("step-datos").click();
    await expect(page.getByTestId("datos-hub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("datos-table")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("step-variables").click();
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("criterion-weights")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("step-resultados").click();
    await expect(page.getByTestId("ranking-view")).toBeVisible({ timeout: 20_000 });
  });

  test("LineUp weight editor available under Más opciones", async ({ page }) => {
    await page.goto(`/variables?c=${encodeConfig({ ...COL, view: "variables" })}`);
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    await openMoreOptions(page);
    await expect(page.getByTestId("lineup-weight-editor")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("lineup-rank-preview")).toBeVisible();
  });

  test("Compare radar picks 2–4 markets", async ({ page }) => {
    await page.goto(`/compare?c=${encodeConfig({ ...COL, view: "compare" })}`);
    await expect(page.getByTestId("market-radar-compare")).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByTestId("compare-radar-table")).toBeVisible();
  });

  test("first-time hint on Home opens the 3-step tour", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("ims-atlas.first-visit-dismissed");
    });
    await page.goto("/inicio");
    await expect(page.getByTestId("home-first-time")).toBeVisible();
    await page.getByTestId("home-tour-open").click();
    await expect(page.getByTestId("onboarding-tour")).toBeVisible();
    await page.getByTestId("tour-skip").click();
    await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);
    await expect(page.getByTestId("home-first-time")).toHaveCount(0);
  });
});
