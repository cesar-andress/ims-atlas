import { expect, test } from "@playwright/test";

test.describe("Phase I access chrome", () => {
  test("header shows Entrar when anonymous", async ({ page }) => {
    await page.goto("/");
    const login = page.getByTestId("access-login");
    await expect(login).toBeVisible();
    await expect(login).toContainText(/Entrar|Sign in/i);
    await expect(page.getByTestId("access-internal-banner")).toHaveCount(0);
  });

  test("authenticated whoami shows team badge and internal banner", async ({
    page,
  }) => {
    await page.route("**/config/access.json", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_mode: "CERRADO",
          admin_mailto: "mailto:ops@example.test",
          auth: {
            portal_url: "https://auth.example.test",
            whoami_path: "/datos-cerrados/whoami.json",
            cerrada_base_path: "/datos-cerrados",
          },
        }),
      });
    });
    await page.route("**/datos-cerrados/whoami.json", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: "atlas.e2e",
          name: "Atlas E2E",
          groups: ["atlas-team", "admins"],
        }),
      });
    });

    await page.goto("/");
    await expect(page.getByTestId("access-badge")).toBeVisible();
    await expect(page.getByTestId("access-badge")).toContainText(
      /Team access|Acceso equipo/i,
    );
    await expect(page.getByTestId("access-internal-banner")).toBeVisible();
    await expect(page.getByTestId("access-login")).toHaveCount(0);
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.getByTestId("privacy-view")).toBeVisible();
  });
});
