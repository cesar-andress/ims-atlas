import { expect, test } from "@playwright/test";
import { encodeConfig, enableVariablesExpert } from "./_helpers";
import { COL_HS64_PRESET } from "../src/state/schema";

test.describe("Phase G projects", () => {
  test("Guardar shows toast (does-nothing regression)", async ({ page }) => {
    await enableVariablesExpert(page);
    await page.goto(
      `/variables?c=${encodeConfig({
        ...COL_HS64_PRESET,
        view: "variables",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("save-project")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("save-project").click();
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
    await expect(page.getByTestId("project-dashboard-view")).toBeVisible({
      timeout: 15_000,
    });
    const name = await page.getByTestId("header-project-name").innerText();
    expect(name.length).toBeGreaterThan(3);

    await page.goto("/projects");
    await expect(page.getByTestId("projects-table")).toBeVisible();
    const openBtn = page.locator('[data-testid^="project-open-"]').first();
    await expect(openBtn).toBeVisible();
    await openBtn.click();
    await expect(page.getByTestId("project-dashboard-view")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("export download and import round-trip", async ({ page }) => {
    await page.goto("/projects");
    await page.getByTestId("project-create").click();
    await expect(page.getByTestId("project-dashboard-view")).toBeVisible({
      timeout: 15_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("project-dash-export-atlas").click();
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
