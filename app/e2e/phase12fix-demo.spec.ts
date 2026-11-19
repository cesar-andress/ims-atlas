/**
 * Phase 12-fix — synthetic demo must not ship; ranking/time agree on same panel.
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeConfig } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const here = dirname(fileURLToPath(import.meta.url));

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

test.describe("Phase 12-fix synthetic demo gate", () => {
  test("home and footer show app + data release versions", async ({ page }) => {
    await page.goto(`/?c=${encodeConfig({ v: 1, view: "home", lang: "en" })}`);
    await expect(page.getByTestId("app-version")).toHaveText("1.0.0");
    await expect(page.getByTestId("home-versions")).toContainText("v1.0.0");
    await expect(page.getByTestId("footer-versions")).toContainText("1.0.0");
  });

  test("public COL/HS64 preset shows data-release-pending empty state", async ({
    page,
  }) => {
    const demo = JSON.parse(
      readFileSync(join(here, "../public/meta/col_hs64_demo.json"), "utf8"),
    ) as { status: string };
    expect(demo.status).toBe("pending");

    await page.goto(`/ranking?c=${encodeConfig({ ...base, view: "ranking" })}`);
    await expect(page.getByTestId("data-release-pending")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ranking-table")).toHaveCount(0);
  });

  test("2023 ranks agree between Ranking and Time for three countries", async ({
    page,
  }) => {
    await routeSyntheticDemoPanel(page);
    // Must appear in both the ranking panel and phase11 bump focus list.
    const focus = ["NLD", "DEU", "FRA"];

    await page.goto(`/ranking?c=${encodeConfig({ ...base, view: "ranking" })}`);
    await expect(page.getByTestId("ranking-table")).toBeVisible({
      timeout: 15_000,
    });
    const ranks: Record<string, string> = {};
    for (const iso of focus) {
      const row = page.locator(`tr[data-iso3="${iso}"]`);
      await expect(row).toBeVisible();
      ranks[iso] = (await row.getAttribute("data-rank"))!;
    }

    await page.goto(`/time?c=${encodeConfig({ ...base, view: "time" })}`);
    await expect(page.getByTestId("bump-table")).toBeVisible({ timeout: 20_000 });
    const yearsHeader = page.locator("[data-testid=bump-table] thead th");
    const headers = await yearsHeader.allTextContents();
    const yearIdx = headers.indexOf("2023");
    expect(yearIdx).toBeGreaterThan(0);

    for (const iso of focus) {
      const cells = page.locator(`tr[data-iso3="${iso}"] td`);
      const cell = cells.nth(yearIdx);
      await expect(cell).toHaveText(ranks[iso]!);
    }
  });
});
