/**
 * SPEC §11 — minimum parity with app-sme (SMIPEM).
 * One Playwright test per table row.
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeConfig } from "./_helpers";

const here = dirname(fileURLToPath(import.meta.url));
const fullFixture = readFileSync(
  join(here, "fixtures/phase8_col_hs64_full.json"),
  "utf8",
);

const COL = {
  v: 1,
  origin: "COL",
  year: 2023,
  hs: "64",
  normalization: "minmax",
  mcdm: "wsm",
  weightScheme: "expert_mean",
  missingThreshold: 0.2,
  lang: "en",
} as const;

async function routeFullPanel(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/meta/phase8_col_hs64.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: fullFixture,
    });
  });
}

test.describe("SPEC §11 parity with app-sme", () => {
  test("any origin country (~190 ISO3 exporters selectable)", async ({ page }) => {
    await page.goto(`/builder?c=${encodeConfig({ ...COL, view: "builder" })}`);
    await expect(page.getByTestId("config-panel")).toBeVisible();
    const countText = await page.getByTestId("origin-count").innerText();
    const n = Number(countText.replace(/[^\d]/g, ""));
    expect(n).toBeGreaterThanOrEqual(190);

    await page.getByTestId("origin-input").fill("ESP");
    await expect(page.getByTestId("origin-hits")).toContainText("ESP");
    await page.getByTestId("origin-hits").getByRole("button", { name: "ESP" }).click();
    await expect(page.getByTestId("builder-summary")).toContainText("ESP");
  });

  test("product search by name, HS2/HS4/HS6 and category tree", async ({ page }) => {
    await page.goto(`/builder?c=${encodeConfig({ ...COL, view: "builder" })}`);
    await expect(page.getByTestId("config-panel")).toBeVisible();

    await page.getByTestId("hs-search").fill("Footwear");
    await expect(page.getByTestId("hs-hits")).toContainText("64");

    await page.getByTestId("hs-search").fill("6403");
    await expect(page.getByTestId("hs-hits")).toContainText("6403");

    await page.getByTestId("hs-search").fill("640399");
    await expect(page.getByTestId("hs-hits")).toContainText("640399");

    await page.getByTestId("hs-category-tree").locator("summary").click();
    await expect(page.getByTestId("hs-category-tree")).toContainText("6403");
    await page
      .getByTestId("hs-category-tree")
      .getByRole("button", { name: /6403/ })
      .click();
    await expect(page.getByTestId("hs-input")).toHaveValue("6403");
  });

  test("per-factor view: raw, normalised, weights, flags", async ({ page }) => {
    await routeFullPanel(page);
    await page.goto(`/factors?c=${encodeConfig({ ...COL, view: "factors" })}`);
    await expect(page.getByTestId("factors-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("factor-criteria-table")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("factor-tab").selectOption("cost_access");
    await expect(page.locator('tr[data-var-id="DIST"]')).toBeVisible();
    await expect(page.getByTestId("raw-DIST")).not.toHaveText("");
    await expect(page.getByTestId("norm-DIST")).not.toHaveText("");
    await expect(page.getByTestId("factor-criteria-table")).toContainText("Raw");
    await expect(page.getByTestId("factor-criteria-table")).toContainText("Normalised");
  });

  test("IMSFE weighting module (expert preset + manual sliders)", async ({ page }) => {
    await routeFullPanel(page);
    await page.goto(`/builder?c=${encodeConfig({ ...COL, view: "builder" })}`);
    await expect(page.getByTestId("weight-scheme")).toBeVisible();
    await expect(page.getByTestId("weight-scheme")).toHaveValue("expert_mean");
    await page.getByTestId("weight-scheme").selectOption("manual");
    await expect(page.getByTestId("weight-sliders")).toBeVisible();
    await expect(page.getByTestId("weight-sliders")).toContainText("demand");
    await expect(page.getByTestId("weight-sliders")).toContainText("sustainability");
  });

  test("consolidated ranking table for all candidates, sortable, CSV export", async ({
    page,
  }) => {
    await routeFullPanel(page);
    await page.goto(`/ranking?c=${encodeConfig({ ...COL, view: "ranking" })}`);
    await expect(page.getByTestId("ranking-table")).toBeVisible({
      timeout: 15_000,
    });
    const rows = page.locator("[data-testid=ranking-table] tbody tr");
    await expect(rows).toHaveCount(60);

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-ranking-csv").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/ranking\.csv/);
    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = readFileSync(path!, "utf8");
    expect(csv.split("\n")[0]).toContain("iso3");
    expect(csv.split("\n")[0]).toContain("score");
    expect(csv).toMatch(/cost_access|demand|sustainability/);
  });

  test("transport / access cost from origin documented (DIST, FTA, PLI)", async ({
    page,
  }) => {
    await routeFullPanel(page);
    await page.goto(`/builder?c=${encodeConfig({ ...COL, view: "builder" })}`);
    await expect(page.getByTestId("factor-group-cost_access")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("var-DIST")).toBeVisible();
    await expect(page.getByTestId("var-FTA")).toBeVisible();
    await expect(page.getByTestId("var-PLI")).toBeVisible();

    await page.goto(`/docs?c=${encodeConfig({ v: 1, view: "docs", lang: "en" })}`);
    await expect(page.getByTestId("docs-transport")).toBeVisible();
    await expect(page.getByTestId("docs-transport")).toContainText("Transport");
  });

  test("sustainability factor (open CO2PC)", async ({ page }) => {
    await routeFullPanel(page);
    await page.goto(`/builder?c=${encodeConfig({ ...COL, view: "builder" })}`);
    await expect(page.getByTestId("factor-group-sustainability")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("var-CO2PC")).toBeVisible();

    await page.goto(`/factors?c=${encodeConfig({ ...COL, view: "factors" })}`);
    await expect(page.getByTestId("factor-tab")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("factor-tab").selectOption("sustainability");
    await expect(page.locator('tr[data-var-id="CO2PC"]')).toBeVisible();

    await page.goto(`/docs?c=${encodeConfig({ v: 1, view: "docs", lang: "en" })}`);
    await expect(page.getByTestId("docs-sustainability")).toBeVisible();
  });

  test("comparative top-10 charts (total / factor / combo) + PNG/SVG/CSV", async ({
    page,
  }) => {
    await routeFullPanel(page);
    await page.goto(`/compare?c=${encodeConfig({ ...COL, view: "compare" })}`);
    await expect(page.getByTestId("compare-view")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("compare-total")).toBeVisible();
    await expect(page.getByTestId("compare-factor")).toBeVisible();
    await expect(page.getByTestId("compare-combo")).toBeVisible();
    await expect(page.getByTestId("top10-chart").first()).toBeVisible({
      timeout: 15_000,
    });

    for (const kind of ["total", "factor", "combo"] as const) {
      const csvDl = page.waitForEvent("download");
      await page.getByTestId(`export-${kind}-csv`).click();
      const dl = await csvDl;
      expect(dl.suggestedFilename()).toMatch(/\.csv$/);

      const pngDl = page.waitForEvent("download");
      await page.getByTestId(`export-${kind}-png`).click();
      const png = await pngDl;
      expect(png.suggestedFilename()).toMatch(/\.png$/);

      const svgDl = page.waitForEvent("download");
      await page.getByTestId(`export-${kind}-svg`).click();
      const svg = await svgDl;
      expect(svg.suggestedFilename()).toMatch(/\.svg$/);
    }
  });

  test("consumer price basket replaced by open WB ICP PLI", async ({ page }) => {
    await routeFullPanel(page);
    await page.goto(`/builder?c=${encodeConfig({ ...COL, view: "builder" })}`);
    await expect(page.getByTestId("var-PLI")).toBeVisible({ timeout: 15_000 });

    await page.goto(`/docs?c=${encodeConfig({ v: 1, view: "docs", lang: "en" })}`);
    await expect(page.getByTestId("docs-pli")).toBeVisible();
    await expect(page.getByTestId("docs-pli")).toContainText("ICP");
  });
});
