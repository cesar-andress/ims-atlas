import { expect, test } from "@playwright/test";
import { encodeConfig, openMoreOptions } from "./_helpers";
import { IMSFE_BAENA_CANO_PRESET } from "../src/state/schema";

test.describe("Phase J IMSFE faithful UI", () => {
  test("Baena & Cano preset and EOC matrix legend", async ({ page }) => {
    await page.goto(
      `/variables?c=${encodeConfig({
        ...IMSFE_BAENA_CANO_PRESET,
        view: "variables",
        lang: "en",
      })}`,
    );
    await openMoreOptions(page);
    await expect(page.getByTestId("method-family")).toHaveAttribute(
      "data-value",
      "imsfe_2025",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("preselect-mode")).toHaveAttribute(
      "data-value",
      "top_n",
    );

    await page.goto(
      `/matrix?c=${encodeConfig({
        ...IMSFE_BAENA_CANO_PRESET,
        view: "matrix",
        matrixMode: "imsfe_eoc",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("matrix-mode")).toHaveAttribute(
      "data-mode",
      "imsfe_eoc",
    );
    await expect(page.getByTestId("imsfe-eoc-legend")).toContainText("GLOBAL LEADERS");
    await expect(page.getByTestId("matrix-authors-note")).toBeVisible();
  });
});
