import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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

test.describe("GUI-0 results dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("read-only dashboard: 0 editable inputs", async ({ page }) => {
    await page.goto(`/ranking?c=${encodeConfig(COL)}`);
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    const n = await page
      .getByTestId("results-dashboard")
      .locator("input, select, textarea")
      .count();
    expect(n).toBe(0);
    await expect(page.getByTestId("change-analysis")).toBeVisible();
    await expect(page.getByTestId("results-kpis")).toBeVisible();
    await expect(page.getByTestId("results-why-card")).toBeVisible();
  });

  test("clicking a rank row updates why card", async ({ page }) => {
    await page.goto(`/ranking?c=${encodeConfig(COL)}`);
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    const second = page.locator("[data-testid=ranking-table] > li").nth(1);
    const iso = await second.getAttribute("data-iso3");
    expect(iso).toBeTruthy();
    await page.getByTestId(`rank-row-${iso}`).click();
    await expect(page.getByTestId("results-why-card")).toContainText(iso!, {
      timeout: 10_000,
    });
  });

  test("screenshots 1440 and 390 light", async ({ page }) => {
    await page.goto(`/ranking?c=${encodeConfig(COL)}`);
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("results-dashboard")).toHaveScreenshot(
      "gui0-results-1440.png",
      { maxDiffPixelRatio: 0.04 },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("results-dashboard")).toHaveScreenshot(
      "gui0-results-390.png",
      { maxDiffPixelRatio: 0.05 },
    );
  });

  test("axe: no serious/critical violations on results", async ({ page }) => {
    await page.goto(`/ranking?c=${encodeConfig(COL)}`);
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    const results = await new AxeBuilder({ page })
      .include('[data-testid="results-dashboard"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const bad = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(bad).toEqual([]);
  });
});
