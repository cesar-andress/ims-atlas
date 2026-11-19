/**
 * Phase V — SPEC §12 VOSviewer-grade market map.
 */
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
  clusterK: 4,
  mapSeed: 42,
  view: "map" as const,
};

test.describe("Phase V VOSviewer-grade map", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("network / overlay / density modes + search focus", async ({ page }) => {
    await page.goto(
      `/map?c=${encodeConfig({ ...base, mapMode: "network", mapColor: "cluster" })}`,
    );
    await expect(page.getByTestId("map-view")).toBeVisible();
    await expect(page.getByTestId("market-map-canvas")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("market-map")).toHaveAttribute(
      "data-mode",
      "network",
    );
    await expect(page.getByTestId("map-stress")).toContainText("edges=");
    await expect(page.getByTestId("map-legend")).toBeVisible();

    await page.getByTestId("map-mode").selectOption("overlay");
    await expect(page.getByTestId("market-map")).toHaveAttribute(
      "data-mode",
      "overlay",
    );
    await expect(page.getByTestId("map-overlay-var")).toBeVisible();
    await expect(page.getByTestId("legend-overlay")).toBeVisible();

    await page.getByTestId("map-mode").selectOption("density");
    await expect(page.getByTestId("market-map")).toHaveAttribute(
      "data-mode",
      "density",
    );
    await expect(page.getByTestId("legend-density")).toBeVisible();

    await page.getByTestId("map-mode").selectOption("network");
    await page.getByTestId("map-search").fill("USA");
    await expect(page.getByTestId("map-search")).toHaveValue("USA");
  });

  test("PNG 4x and SVG export downloads", async ({ page }) => {
    await page.goto(`/map?c=${encodeConfig({ ...base, mapMode: "network" })}`);
    await expect(page.getByTestId("market-map-canvas")).toBeVisible({
      timeout: 20_000,
    });

    const pngDl = page.waitForEvent("download");
    await page.getByTestId("export-map-png").click();
    const png = await pngDl;
    expect(png.suggestedFilename()).toMatch(/\.png$/);

    const svgDl = page.waitForEvent("download");
    await page.getByTestId("export-map-svg").click();
    const svg = await svgDl;
    expect(svg.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("200-node paint stays under frame budget (50 ms)", async ({ page }) => {
    await page.goto(`/map?c=${encodeConfig({ ...base, mapMode: "network" })}`);
    await expect(page.getByTestId("market-map-canvas")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("map-perf-200").click({ force: true });
    await expect(page.getByTestId("map-perf-ms")).toBeVisible();
    const text = await page.getByTestId("map-perf-ms").innerText();
    const ms = Number(text);
    expect(ms).toBeGreaterThan(0);
    // Headless CI budget: ~30 fps → 33 ms; allow 50 ms headroom.
    expect(ms).toBeLessThan(50);
  });

  test("visual snapshot network mode", async ({ page }) => {
    await page.goto(
      `/map?c=${encodeConfig({
        ...base,
        mapMode: "network",
        mapColor: "cluster",
        mapSeed: 42,
      })}`,
    );
    await expect(page.getByTestId("market-map-canvas")).toBeVisible({
      timeout: 20_000,
    });
    // Canvas only: toolbar export chrome must not shift the visual baseline.
    await expect(page.getByTestId("market-map-canvas")).toHaveScreenshot(
      "vosviewer-network.png",
      {
        maxDiffPixels: 400,
      },
    );
  });
});
