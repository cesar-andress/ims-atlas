import { expect, test } from "@playwright/test";

test.describe("permalink + catalog", () => {
  test("opens catalog permalink, shows catalog, reload keeps state", async ({
    page,
  }) => {
    // Compact config: catalog + COL + 2019
    const config = {
      v: 1,
      view: "catalog",
      origin: "COL",
      year: 2019,
      lang: "en",
    };
    const json = JSON.stringify(config);
    const b64 = Buffer.from(json, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await page.goto(`/catalog?c=${b64}`);
    await expect(page.getByTestId("catalog-view")).toBeVisible();
    await expect(page.getByTestId("catalog-config-echo")).toContainText("COL");
    await expect(page.getByTestId("catalog-config-echo")).toContainText("2019");
    await expect(page.getByTestId("config-panel")).toBeVisible();

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
