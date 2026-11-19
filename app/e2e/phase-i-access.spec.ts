import { expect, test } from "@playwright/test";

test.describe("Phase I access chrome", () => {
  test("header shows Entrar when anonymous", async ({ page }) => {
    await page.goto("/");
    const login = page.getByTestId("access-login");
    await expect(login).toBeVisible();
    await expect(login).toContainText(/Entrar|Sign in/i);
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.getByTestId("privacy-view")).toBeVisible();
  });
});
