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

test.describe("Phase X export surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("compare charts expose ExportMenu", async ({ page }) => {
    await page.goto(`/compare?c=${encodeConfig({ ...COL, view: "compare" })}`);
    await expect(page.getByTestId("export-menu-total")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("export-total-png")).toBeVisible();
    await expect(page.getByTestId("export-menu-factor")).toBeVisible();
    await expect(page.getByTestId("export-menu-combo")).toBeVisible();
  });

  test("ranking table has ExportMenu", async ({ page }) => {
    await page.goto(`/ranking?c=${encodeConfig({ ...COL, view: "ranking" })}`);
    await expect(page.getByTestId("export-menu-ranking")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("export-ranking-csv")).toBeVisible();
    await expect(page.getByTestId("export-ranking-xlsx")).toBeVisible();
  });

  test("map export menu present", async ({ page }) => {
    await page.goto(`/map?c=${encodeConfig({ ...COL, view: "map" })}`);
    await expect(page.getByTestId("export-menu-map")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("export-map-png")).toBeVisible();
  });

  test("cite page offers full analysis / PDF / IMSFE book", async ({ page }) => {
    await page.goto(`/cite?c=${encodeConfig({ ...COL, view: "cite" })}`);
    await expect(page.getByTestId("cite-body")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("export-full-xlsx")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("export-pdf-report")).toBeVisible();
    await expect(page.getByTestId("export-imsfe-book")).toBeVisible();
  });

  test("every data-export-surface has an export menu nearby", async ({ page }) => {
    await page.goto(`/compare?c=${encodeConfig({ ...COL, view: "compare" })}`);
    await expect(page.getByTestId("compare-charts")).toBeVisible({
      timeout: 20_000,
    });
    const orphan = await page.evaluate(() => {
      const surfaces = Array.from(document.querySelectorAll("[data-export-surface]"));
      return surfaces
        .filter((el) => {
          const menu =
            el.querySelector('[data-testid^="export-menu-"]') ||
            el.parentElement?.querySelector('[data-testid^="export-menu-"]');
          return !menu;
        })
        .map((el) => el.getAttribute("data-testid") || el.tagName);
    });
    expect(orphan).toEqual([]);
  });
});
