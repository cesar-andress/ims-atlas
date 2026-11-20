import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeConfig } from "./_helpers";

const here = dirname(fileURLToPath(import.meta.url));

const golden = JSON.parse(
  readFileSync(
    join(here, "../../core/fixtures/phase8/synthetic_col_hs64.json"),
    "utf8",
  ),
) as {
  block: { ranking_expert: { iso3: string; score: number; rank: number }[] };
};

const fullFixture = readFileSync(
  join(here, "fixtures/synthetic_col_hs64_full.json"),
  "utf8",
);

test.describe("COL HS64 2023 IMSFE ranking", () => {
  test("builder → ranking matches ims-backtest top ranks (synthetic e2e route)", async ({
    page,
  }) => {
    // Private synthetic panel — never shipped under app/public.
    await page.route("**/meta/col_hs64_demo.json", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: fullFixture,
      });
    });

    const config = {
      v: 1,
      view: "builder",
      origin: "COL",
      year: 2023,
      hs: "64",
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "expert_mean",
      missingThreshold: 0.2,
      lang: "en",
    };
    await page.goto(`/variables?c=${encodeConfig({ ...config, view: "variables" })}`);
    await expect(page.getByTestId("variables-hub")).toBeVisible();
    await expect(page.getByTestId("project-chips")).toContainText("Colombia");
    await page.getByTestId("step-resultados").click();
    await expect(page.getByTestId("ranking-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ranking-table")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("results-dashboard")).toBeVisible();
    const top = golden.block.ranking_expert[0]!;
    const topRow = page.getByTestId(`rank-row-${top.iso3}`);
    await expect(topRow).toHaveAttribute("data-rank", "1");
    const scoreAttr = await page
      .getByTestId(`score-${top.iso3}`)
      .getAttribute("data-score");
    const score = Number(scoreAttr);
    expect(Math.abs(score - top.score)).toBeLessThanOrEqual(1e-9);

    for (const i of [1, 2]) {
      const exp = golden.block.ranking_expert[i]!;
      await expect(page.getByTestId(`rank-row-${exp.iso3}`)).toHaveAttribute(
        "data-rank",
        String(exp.rank),
      );
    }

    // Editable controls on the results screen must stay at 0 (GUI-0).
    const editable = await page
      .getByTestId("results-dashboard")
      .locator("input, select, textarea")
      .count();
    expect(editable).toBe(0);

    await page.reload();
    await expect(page.getByTestId(`rank-row-${top.iso3}`)).toHaveAttribute(
      "data-rank",
      "1",
      { timeout: 15_000 },
    );
  });

  test("public demo is pending (no synthetic ranks shipped)", async ({ page }) => {
    const publicDemo = JSON.parse(
      readFileSync(join(here, "../public/meta/col_hs64_demo.json"), "utf8"),
    ) as { status: string; block?: unknown };
    expect(publicDemo.status).toBe("pending");
    expect(publicDemo.block).toBeUndefined();

    const config = {
      v: 1,
      view: "ranking",
      origin: "COL",
      year: 2023,
      hs: "64",
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "expert_mean",
      missingThreshold: 0.2,
      lang: "en",
    };
    await page.goto(`/ranking?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("ranking-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("data-release-pending")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ranking-table")).toHaveCount(0);
  });

  test("permalink lang=es applies Spanish chrome", async ({ page }) => {
    const config = {
      v: 1,
      view: "home",
      lang: "es" as const,
    };
    await page.goto(`/?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.getByTestId("footer-atlas-credit")).toContainText(
      "AISERV SYSTEMS SLU",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
