/**
 * Prompt 4e LIVE proof (optional).
 *
 * Requires ATLAS_E2E_BASE_URL + ATLAS_E2E_USER + ATLAS_E2E_PASS (never commit).
 * Screenshots: /tmp/atlas-e2e-shots/{mercado,plan4p,envio}.png
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { e2eCredentials, loginViaAutheliaIfNeeded } from "./autheliaLogin";
import { openScopeDialog, skipOnboarding } from "./_helpers";

const baseURL = process.env.ATLAS_E2E_BASE_URL?.replace(/\/$/, "");
const shotsDir = process.env.ATLAS_E2E_SHOTS_DIR?.trim() || "/tmp/atlas-e2e-shots";

async function shot(page: Page, name: string): Promise<string> {
  await mkdir(shotsDir, { recursive: true });
  const file = path.join(shotsDir, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function setEspCafe2024Scope(page: Page): Promise<void> {
  await openScopeDialog(page, "origin");
  await page.getByTestId("origin-input").fill("ESP");
  await expect(page.getByTestId("origin-hits")).toContainText("ESP");
  await page
    .getByTestId("origin-hits")
    .getByRole("button", { name: /ESP/ })
    .first()
    .click();
  await expect(page.getByTestId("origin-input")).toHaveValue("ESP");

  await page.getByTestId("hs-search").fill("0901");
  await expect(page.getByTestId("hs-hits")).toContainText(/0901|09/i, {
    timeout: 15_000,
  });
  await page
    .getByTestId("hs-hits")
    .getByRole("option")
    .filter({ hasText: /0901|café|coffee/i })
    .first()
    .click();
  await expect(page.getByTestId("hs-input")).toHaveValue(/09/);

  await page.getByTestId("year-input").selectOption("2024");
  await page.getByTestId("project-scope-done").click();
  await expect(page.getByTestId("project-scope-dialog")).toHaveCount(0);
}

async function loginAndOpenEspCafe2024(page: Page): Promise<void> {
  await skipOnboarding(page);
  await page.goto(`${baseURL}/inicio`, { waitUntil: "domcontentloaded" });
  const loggedIn = await loginViaAutheliaIfNeeded(page);
  expect(loggedIn, "Authelia login failed or needs a second factor").toBe(true);

  await page.goto(`${baseURL}/inicio`, { waitUntil: "domcontentloaded" });
  await loginViaAutheliaIfNeeded(page);
  await expect(page.getByTestId("home-view")).toBeVisible({ timeout: 45_000 });

  const newBtn = page.getByTestId("project-new");
  await expect(newBtn).toBeVisible({ timeout: 30_000 });
  await newBtn.click();

  await expect(page.getByTestId("project-bar")).toBeVisible({ timeout: 30_000 });
  await setEspCafe2024Scope(page);

  await page.getByTestId("step-resultados").click({ timeout: 30_000 });
  await page.waitForTimeout(8_000);
  await expect(page.getByTestId("step-mercado")).toBeVisible({ timeout: 30_000 });
}

test.describe("ESP · café · 2024 live panel", () => {
  test.skip(!baseURL, "Set ATLAS_E2E_BASE_URL to run against the live host");
  test.skip(
    !e2eCredentials(),
    "Set ATLAS_E2E_USER and ATLAS_E2E_PASS for Authelia login",
  );

  test("Mercado DE → Plan 4P → Preparar envío screenshots", async ({ page }) => {
    test.setTimeout(240_000);
    await loginAndOpenEspCafe2024(page);

    await page.getByTestId("step-mercado").click();
    await expect(page.getByTestId("mercado-objetivo")).toBeVisible({
      timeout: 30_000,
    });

    const deuTarget = page.getByTestId("mercado-target-DEU");
    await expect(
      deuTarget,
      "DEU must appear in the live ranking for ESP·café·2024",
    ).toBeVisible({ timeout: 90_000 });
    await deuTarget.click();
    await expect(page.getByTestId("mercado-target-label")).toContainText(
      /alemania|germany|DEU/i,
    );
    await shot(page, "mercado.png");

    await page.getByTestId("step-plan4p").click();
    await expect(page.getByTestId("plan4p-grid")).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, "plan4p.png");

    await page.getByTestId("step-envio").click();
    await expect(page.getByTestId("preparar-envio")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("envio-tab-incoterms").click();
    await expect(page.getByTestId("envio-incoterms")).toBeVisible();
    await shot(page, "envio.png");

    await expect(page.getByTestId("envio-duty")).toHaveValue("0");
    await expect(page.getByTestId("envio-vat")).toHaveValue("19");
    await expect(page.getByTestId("envio-fx")).toHaveValue("1");
    await expect(page.getByTestId("envio-jose-preset-pill")).toHaveCount(0);
    await expect(page.getByTestId("envio-load-jose")).toBeVisible();
    await expect(page.getByTestId("envio-delay-cost")).toHaveValue("");
  });
});
