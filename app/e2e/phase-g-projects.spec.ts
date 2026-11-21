import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";
import { COL_HS64_PRESET } from "../src/state/schema";

test.describe("Phase G projects", () => {
  test("Guardar shows toast (does-nothing regression)", async ({ page }) => {
    await page.goto(
      `/variables?c=${encodeConfig({
        ...COL_HS64_PRESET,
        view: "variables",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("project-save")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("project-save").click();
    await expect(page.getByTestId("toast")).toContainText(
      /Project saved|Proyecto guardado/,
      {
        timeout: 5_000,
      },
    );
  });

  test("create, reload, reopen project from /projects", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByTestId("projects-view")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("project-create").click();
    await expect(page.getByTestId("toast")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("results-shell")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("project-bar")).toBeVisible();
    const name = await page.getByTestId("header-project-name").innerText();
    expect(name.length).toBeGreaterThan(3);

    await page.goto("/projects");
    await expect(page.getByTestId("projects-table")).toBeVisible();
    const openBtn = page.locator('[data-testid^="project-open-"]').first();
    await expect(openBtn).toBeVisible();
    await openBtn.click();
    await expect(page.getByTestId("results-shell")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("export download and import round-trip", async ({ page }) => {
    await page.goto("/projects");
    await page.getByTestId("project-create").click();
    await expect(page.getByTestId("project-bar")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("project-export").locator("summary").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("project-export-atlas").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.atlas\.json$/);
    const path = await download.path();
    expect(path).toBeTruthy();

    await page.goto("/projects");
    await page.getByTestId("project-import").setInputFiles(path!);
    await expect(page.getByTestId("toast")).toContainText(/imported|importado/i, {
      timeout: 5_000,
    });
  });

  test("legacy project_dashboard redirects to modern project chrome", async ({
    page,
  }) => {
    await page.goto(
      `/project_dashboard?c=${encodeConfig({
        ...COL_HS64_PRESET,
        view: "project_dashboard",
        lang: "en",
      })}`,
    );
    await expect(page).toHaveURL(/\/analisis/);
    await expect(page.getByTestId("results-shell")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("project-bar")).toBeVisible();
  });

  test("coverage grid renders with policies", async ({ page }) => {
    await page.goto(
      `/project_coverage?c=${encodeConfig({
        ...COL_HS64_PRESET,
        view: "project_coverage",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("project-coverage-view")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("project-coverage-body")).toBeVisible();
    await expect(page.getByTestId("project-coverage-grid")).toBeVisible();
  });
});
