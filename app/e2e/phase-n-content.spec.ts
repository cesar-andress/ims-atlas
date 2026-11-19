import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";

test.describe("Phase N content and help", () => {
  test("docs exposes getting started and sources sections", async ({ page }) => {
    await page.goto(`/docs?c=${encodeConfig({ v: 1, view: "docs", lang: "en" })}`);
    await expect(page.getByTestId("docs-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("docs-getting-started")).toContainText(
      "five minutes",
    );
    await expect(page.getByTestId("docs-sources")).toBeVisible();
    await expect(page.getByTestId("docs-cite")).toBeVisible();
    await expect(page.getByTestId("docs-imsfe-workflow")).toBeVisible();
  });

  test("help drawer opens from ranking and links to docs", async ({ page }) => {
    await page.goto(
      `/ranking?c=${encodeConfig({
        v: 1,
        view: "ranking",
        origin: "COL",
        hs: "64",
        year: 2023,
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("help-btn-non_experts")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("help-btn-non_experts").click();
    await expect(page.getByTestId("help-drawer")).toBeVisible();
    await expect(page.getByTestId("help-drawer-docs-link")).toBeVisible();
    await page.getByTestId("help-drawer-close").click();
    await expect(page.getByTestId("help-drawer")).toHaveCount(0);
  });

  test("paper page shows T4 NDCG table from fixture", async ({ page }) => {
    await page.goto(`/paper?c=${encodeConfig({ v: 1, view: "paper", lang: "en" })}`);
    await expect(page.getByTestId("paper-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("paper-t4-ndcg")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("paper-link-backtest")).toBeVisible();
  });

  test("changelog page renders CHANGELOG headings", async ({ page }) => {
    await page.goto(
      `/changelog?c=${encodeConfig({ v: 1, view: "changelog", lang: "en" })}`,
    );
    await expect(page.getByTestId("changelog-view")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("changelog-body")).toContainText("Unreleased");
  });
});
