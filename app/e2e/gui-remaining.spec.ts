import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const COL = {
  v: 1 as const,
  origin: "COL",
  year: 2023,
  hs: "64",
  lang: "en" as const,
};

test.describe("GUI remaining: tour, LineUp, compare, clicks", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
    await page.addInitScript(() => {
      localStorage.setItem("ims-atlas.onboarding.done", "1");
      localStorage.setItem("ims-atlas.variables.expert", "1");
    });
  });

  test("5 click path: home → datos → variables → analisis → ranking", async ({
    page,
  }) => {
    await page.goto(`/?c=${encodeConfig({ ...COL, view: "home" })}`);
    await page.getByTestId("home-card-datos").click();
    await expect(page.getByTestId("datos-hub")).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("link", { name: /variables/i })
      .first()
      .click();
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("link", { name: /an[aá]lisis|analysis/i })
      .first()
      .click();
    await expect(page.getByTestId("analisis-gallery")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("study-open-ranking").click();
    await expect(page.getByTestId("ranking-view")).toBeVisible({ timeout: 20_000 });
  });

  test("LineUp weight editor visible in Variables", async ({ page }) => {
    await page.goto(`/variables?c=${encodeConfig({ ...COL, view: "variables" })}`);
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    const toggle = page.getByTestId("variables-expert-toggle");
    if (!(await toggle.isChecked())) await toggle.check();
    await expect(page.getByTestId("lineup-weight-editor")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("lineup-rank-preview")).toBeVisible();
  });

  test("Compare radar picks 2–4 markets", async ({ page }) => {
    await page.goto(`/compare?c=${encodeConfig({ ...COL, view: "compare" })}`);
    await expect(page.getByTestId("market-radar-compare")).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByTestId("compare-radar-table")).toBeVisible();
  });

  test("tour reopen control in footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("tour-reopen")).toBeVisible();
    await page.getByTestId("tour-reopen").click();
    await expect(page.getByTestId("onboarding-tour")).toBeVisible();
    await page.getByTestId("tour-skip").click();
    await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);
  });
});
