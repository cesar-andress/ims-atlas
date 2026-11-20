import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";

test.describe("Phase E data explorer", () => {
  test("global search opens with / and finds a variable", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("header-overflow-toggle").click();
    await expect(page.getByTestId("global-search-open")).toBeVisible({
      timeout: 15_000,
    });
    await page.keyboard.press("/");
    await expect(page.getByTestId("global-search-input")).toBeFocused();
    await page.getByTestId("global-search-input").fill("GDP");
    await expect(page.getByTestId("global-search-results")).toBeVisible();
    const hit = page.locator('[data-testid^="search-hit-variables-"]').first();
    await expect(hit).toBeVisible({ timeout: 10_000 });
    await hit.click();
    await expect(page.getByTestId("data-variable-view")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("explore filters and basket permalink", async ({ page }) => {
    await page.goto(
      `/explore?c=${encodeConfig({
        v: 1,
        view: "explore",
        exploreYearFrom: 2020,
        exploreYearTo: 2023,
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("explore-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("explore-filters")).toBeVisible();
    await expect(page.getByTestId("explore-year-from")).toHaveValue("2020");
    await page.getByTestId("explore-licence").selectOption("open");
    const add = page.locator('[data-testid^="explore-add-"]').first();
    if (await add.isVisible()) {
      await add.click();
      await expect(page.getByTestId("variable-basket")).toBeVisible();
      await expect(page.getByTestId("basket-list").locator("li")).toHaveCount(1, {
        timeout: 5_000,
      });
    }
  });

  test("country profile and sql expert gate", async ({ page }) => {
    await page.goto(
      `/country?c=${encodeConfig({
        v: 1,
        view: "country",
        focusCountry: "COL",
        year: 2023,
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("country-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("country-heading")).toContainText("COL");

    await page.goto("/sql");
    await expect(page.getByTestId("sql-locked")).toBeVisible();
    await page.getByTestId("sql-enable-expert").click();
    await expect(page.getByTestId("sql-input")).toBeVisible();
  });

  test("explore analysis scatter controls", async ({ page }) => {
    await page.goto(
      `/explore_analysis?c=${encodeConfig({
        v: 1,
        view: "explore_analysis",
        variableIds: ["GDPPC", "LPI"],
        year: 2023,
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("explore-analysis-view")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("scatter-x")).toBeVisible();
    await expect(page.getByTestId("scatter-svg")).toBeVisible();
  });
});
