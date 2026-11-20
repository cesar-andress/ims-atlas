import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";

async function mockTeamSession(page: import("@playwright/test").Page) {
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
        groups: ["atlas-team"],
      }),
    });
  });
  await page.route("**/api/projects/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "e2e-shared",
            name: "Shared HS64",
            createdAt: "2026-11-20T10:00:00Z",
            updatedAt: "2026-11-20T12:00:00Z",
            createdBy: "atlas.e2e",
            updatedBy: "atlas.e2e",
            source: "team",
            origin: "COL",
            hs: "64",
            yearFrom: 2023,
            yearTo: 2023,
          },
        ]),
      });
      return;
    }
    await route.fulfill({ status: 200, body: "{}" });
  });
  await page.route("**/api/projects/e2e-shared", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 2,
        kind: "ims-atlas-project",
        id: "e2e-shared",
        name: "Shared HS64",
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T12:00:00Z",
        config: {
          v: 1,
          view: "analisis",
          origin: "COL",
          hs: "64",
          year: 2023,
          lang: "en",
        },
        yearFrom: 2023,
        yearTo: 2023,
      }),
    });
  });
}

test.describe("Team tools layout", () => {
  test("groups tools without Abrir card buttons", async ({ page }) => {
    await mockTeamSession(page);
    await page.goto(
      `/advanced_tools?c=${encodeConfig({
        v: 1,
        view: "advanced_tools",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("advanced-tools")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("advanced-tools-intro")).toBeVisible();
    await expect(page.getByTestId("advanced-tool-data_sources")).toBeVisible();
    await expect(page.getByTestId("advanced-tool-norm_lab")).toBeVisible();
    await expect(page.getByTestId("advanced-tool-sql")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open$|^Abrir$/ })).toHaveCount(0);
    // On the tools page the user menu must not repeat the same destination.
    await page.getByTestId("access-badge").click();
    await expect(page.getByTestId("team-tools-link")).toHaveCount(0);
  });
});

test.describe("Header project switcher", () => {
  test("opens a shared team project from the dropdown", async ({ page }) => {
    await mockTeamSession(page);
    await page.goto(`/inicio?c=${encodeConfig({ v: 1, view: "home", lang: "en" })}`);
    await expect(page.getByTestId("project-switcher")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("project-switcher-toggle").click();
    await expect(page.getByTestId("project-switcher-menu")).toBeVisible();
    await expect(page.getByTestId("project-switcher-item-e2e-shared")).toBeVisible();
    await page.getByTestId("project-switcher-item-e2e-shared").click();
    await expect(page.getByTestId("header-project-name")).toContainText("Shared HS64", {
      timeout: 10_000,
    });
  });
});
