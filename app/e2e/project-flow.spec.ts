/**
 * Simplified project flow: Spanish default, one-row header, home with the example
 * project, project bar + three steps, criterion cards, Fuentes y datos, footer.
 */
import { expect, test } from "@playwright/test";
import { encodeConfig, openScopeDialog } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const COL = {
  v: 1 as const,
  origin: "COL",
  hs: "64",
  year: 2023,
  lang: "en" as const,
  normalization: "minmax" as const,
  mcdm: "wsm" as const,
  weightScheme: "expert_mean" as const,
  missingThreshold: 0.2,
};

test.describe("Default language", () => {
  // No saved preference: the UI must open in Spanish.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Spanish is the default; the ES/EN switch changes it and is remembered", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await expect(page.getByTestId("home-view").locator("h1")).toHaveText(
      "Tus proyectos",
    );
    await expect(page.getByTestId("help-open")).toHaveText("Ayuda");
    await expect(page.getByTestId("lang-es")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("lang-en").click();
    await expect(page.getByTestId("home-view").locator("h1")).toHaveText(
      "Your projects",
    );
    await expect(page.getByTestId("help-open")).toHaveText("Help");

    await page.reload();
    await expect(page.getByTestId("home-view").locator("h1")).toHaveText(
      "Your projects",
    );
  });
});

test.describe("Home and project bar", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("first visit creates the example project; the bar is hidden on Home", async ({
    page,
  }) => {
    await page.goto("/inicio");
    const example = page.locator('[data-example="1"]');
    await expect(example).toBeVisible({ timeout: 15_000 });
    await expect(example).toContainText("Colombian footwear");
    await expect(page.getByTestId("project-card-example")).toHaveText("Example");
    await expect(page.getByTestId("project-new")).toBeVisible();
    await expect(page.getByTestId("project-bar")).toHaveCount(0);
    // No release / version / empty-data messaging on Home.
    await expect(page.getByTestId("home-view")).not.toContainText(/release|version/i);
  });

  test("opening the example shows the bar, chips and the three steps", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await page.locator('[data-example="1"]').click();
    await expect(page.getByTestId("results-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("project-name")).toContainText("Colombian footwear");
    await expect(page.getByTestId("project-saved")).toBeVisible();
    await expect(page.getByTestId("project-example-badge")).toBeVisible();
    for (const chip of ["origin", "product", "year", "markets", "criteria", "method"]) {
      await expect(page.getByTestId(`chip-${chip}`)).toBeVisible();
    }
    await expect(page.getByTestId("step-resultados")).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.getByTestId("project-duplicate")).toBeVisible();
    await expect(page.getByTestId("project-export")).toBeVisible();
    await expect(page.getByTestId("header-project-name")).toContainText(
      "Colombian footwear",
    );
  });

  test("results tabs reach the matrix and stay read-only", async ({ page }) => {
    await page.goto(`/analisis?c=${encodeConfig({ ...COL, view: "analisis" })}`);
    await expect(page.getByTestId("results-tabs")).toBeVisible({ timeout: 20_000 });
    for (const tab of ["ranking", "matrix", "map", "compare", "time", "backtest"]) {
      await expect(page.getByTestId(`results-tab-${tab}`)).toBeVisible();
    }
    await page.getByTestId("results-tab-matrix").click();
    await expect(page.getByTestId("matrix-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("results-tab-matrix")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("main").locator("input, select, textarea")).toHaveCount(
      0,
    );
  });

  test("origin, product and year are edited from the bar chips", async ({ page }) => {
    await page.goto(`/variables?c=${encodeConfig({ ...COL, view: "variables" })}`);
    await expect(page.getByTestId("variables-hub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("origin-input")).toHaveCount(0);
    await openScopeDialog(page, "year");
    await expect(page.getByTestId("year-input")).toHaveValue("2023");
    await page.getByTestId("project-scope-done").click();
    await expect(page.getByTestId("project-scope-dialog")).toHaveCount(0);
  });
});

test.describe("Variables y pesos", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("a slider changes one criterion; the reset returns to the experts' weights", async ({
    page,
  }) => {
    await page.goto(`/variables?c=${encodeConfig({ ...COL, view: "variables" })}`);
    await expect(page.getByTestId("criterion-weights")).toBeVisible({
      timeout: 20_000,
    });
    const reset = page.getByTestId("weights-reset-experts");
    await expect(reset).toBeDisabled();

    const cards = page.locator('[data-testid^="criterion-card-"]');
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(2);
    const firstId = (await cards.first().getAttribute("data-testid"))!.replace(
      "criterion-card-",
      "",
    );
    const slider = page.getByTestId(`criterion-slider-${firstId}`);
    await slider.fill("60");
    await slider.blur();
    await expect(page.getByTestId(`criterion-pct-${firstId}`)).toHaveText("60%", {
      timeout: 15_000,
    });
    await expect(reset).toBeEnabled();

    const pcts = await page.locator('[data-testid^="criterion-pct-"]').allInnerTexts();
    const total = pcts.reduce((a, p) => a + Number(p.replace("%", "")), 0);
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(n); // rounding of n shares

    await reset.click();
    await expect(reset).toBeDisabled({ timeout: 15_000 });
    await expect(page.getByTestId("weights-source")).toContainText(/experts/i);
  });
});

test.describe("Datos, Fuentes y datos and footer", () => {
  test("Datos is one table plus a link to upload my data", async ({ page }) => {
    await page.goto(`/datos?c=${encodeConfig({ ...COL, view: "datos" })}`);
    await expect(page.getByTestId("datos-hub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("datos-byod-link")).toHaveText("Upload my data");
    const heads = page.getByTestId("datos-table").locator("thead th");
    if (await page.getByTestId("datos-table").count()) {
      await expect(heads).toHaveText([
        "What it measures",
        "Source",
        "Access",
        "Updated",
        "Markets with data",
      ]);
    }
  });

  test("footer links open Fuentes y datos tabs; team tools are not in the footer", async ({
    page,
  }) => {
    await page.goto("/inicio");
    const footer = page.getByTestId("site-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByTestId("footer-sources")).toBeVisible();
    await expect(footer.getByTestId("footer-updates")).toBeVisible();
    await expect(footer.getByTestId("footer-cite")).toBeVisible();
    await expect(footer.getByTestId("footer-docs")).toBeVisible();
    await expect(footer.getByTestId("footer-privacy")).toBeVisible();
    await expect(footer.getByRole("link", { name: /repository/i })).toBeVisible();
    await expect(footer.getByText(/team tools/i)).toHaveCount(0);

    await footer.getByTestId("footer-updates").click();
    await expect(page.getByTestId("fuentes-datos")).toBeVisible();
    await expect(page.getByTestId("fuentes-panel-novedades")).toBeVisible();
    await expect(page.getByTestId("fuentes-tab-novedades")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
