import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";

test.describe("Phase 12 docs + a11y basics", () => {
  test("docs page exposes methods, glossary, tutorials, FAQ", async ({ page }) => {
    await page.goto(`/docs?c=${encodeConfig({ v: 1, view: "docs", lang: "en" })}`);
    await expect(page.getByTestId("docs-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("docs-toc")).toBeVisible();
    await expect(page.getByTestId("docs-methods")).toContainText("WSM");
    await expect(page.getByTestId("docs-glossary")).toContainText("NDCG@k");
    await expect(page.getByTestId("docs-tutorials")).toBeVisible();
    await expect(page.getByTestId("docs-faq")).toContainText("causal");
  });

  test("skip link targets main content", async ({ page }) => {
    await page.goto("/");
    const skip = page.locator(".skip-link");
    await expect(skip).toHaveAttribute("href", "#main-content");
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("mobile viewport shows read-only banner on analysis views", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `/ranking?c=${encodeConfig({
        v: 1,
        view: "ranking",
        origin: "COL",
        year: 2023,
        hs: "64",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("mobile-readonly")).toBeVisible({ timeout: 15_000 });
  });
});
