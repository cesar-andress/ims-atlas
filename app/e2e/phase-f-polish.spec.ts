import { expect, test } from "@playwright/test";

test.describe("Phase F polish", () => {
  test("footer shows Atlas credit and R&D placeholder blocker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("footer-atlas-credit")).toContainText("IMS Atlas");
    await expect(page.getByTestId("footer-rd-blocker")).toBeVisible();
    await expect(page.getByTestId("footer-rd-blocker")).toHaveAttribute(
      "data-blocker",
      "rd-project-name",
    );
  });
});
