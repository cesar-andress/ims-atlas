import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";

test.describe("permalink + catalog", () => {
  test("opens catalog permalink, shows catalog, reload keeps state", async ({
    page,
  }) => {
    const config = {
      v: 1,
      view: "catalog",
      origin: "COL",
      year: 2019,
      lang: "en",
    };

    await page.goto(`/catalog?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("catalog-view")).toBeVisible();
    await expect(page.getByTestId("catalog-config-echo")).toContainText("COL");
    await expect(page.getByTestId("catalog-config-echo")).toContainText("2019");
    // Config panel is reserved for analysis views (builder/ranking/matrix/map).
    await expect(page.getByTestId("config-panel")).toHaveCount(0);
    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.getByTestId("main-nav")).toHaveCount(0);

    // Wait for catalog variables to load from preview JSON
    await expect(page.locator(".catalog-list .var-id").first()).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByTestId("catalog-view")).toBeVisible();
    await expect(page.getByTestId("catalog-config-echo")).toContainText("COL");
    await expect(page.getByTestId("catalog-config-echo")).toContainText("2019");
    await expect(page).toHaveURL(/c=/);
  });
});
