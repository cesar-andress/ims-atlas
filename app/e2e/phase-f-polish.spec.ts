import { expect, test } from "@playwright/test";

test.describe("Phase F polish", () => {
  test("footer shows Atlas credit and no bracketed placeholder", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("footer-atlas-credit")).toContainText("IMS Atlas");
    await expect(page.getByTestId("footer-atlas-credit")).toContainText(
      "AISERV SYSTEMS SLU",
    );
    await expect(page.getByTestId("footer-rd-blocker")).toHaveCount(0);
    await expect(page.locator("footer")).not.toContainText("[");
  });
});
