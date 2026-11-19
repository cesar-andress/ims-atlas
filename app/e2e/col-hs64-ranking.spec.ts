import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeConfig } from "./_helpers";

const here = dirname(fileURLToPath(import.meta.url));

const golden = JSON.parse(
  readFileSync(join(here, "../../core/fixtures/phase8/golden.json"), "utf8"),
) as {
  block: { ranking_expert: { iso3: string; score: number; rank: number }[] };
};

const fullFixture = readFileSync(
  join(here, "fixtures/phase8_col_hs64_full.json"),
  "utf8",
);

test.describe("COL HS64 2023 IMSFE ranking", () => {
  test("builder → ranking matches ims-backtest top ranks", async ({ page }) => {
    // Private full panel (incl. TARIF/CULT) — never shipped under app/public.
    await page.route("**/meta/phase8_col_hs64.json", async (route) => {
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
    await page.goto(`/builder?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("builder-view")).toBeVisible();
    await expect(page.getByTestId("builder-summary")).toContainText("COL");
    await expect(page.getByTestId("builder-summary")).toContainText("2023");

    await page.getByTestId("builder-to-ranking").click();
    await expect(page.getByTestId("ranking-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ranking-table")).toBeVisible({ timeout: 15_000 });

    const top = golden.block.ranking_expert[0]!;
    const topRow = page.locator(`tr[data-iso3="${top.iso3}"]`);
    await expect(topRow).toHaveAttribute("data-rank", "1");
    const scoreAttr = await page
      .getByTestId(`score-${top.iso3}`)
      .getAttribute("data-score");
    const score = Number(scoreAttr);
    expect(Math.abs(score - top.score)).toBeLessThanOrEqual(1e-9);

    // Second and third ranks
    for (const i of [1, 2]) {
      const exp = golden.block.ranking_expert[i]!;
      await expect(page.locator(`tr[data-iso3="${exp.iso3}"]`)).toHaveAttribute(
        "data-rank",
        String(exp.rank),
      );
    }

    await expect(page.getByTestId("map-licence")).toBeVisible();
    await expect(page.getByTestId("world-choropleth")).toBeVisible();

    const elapsedText = await page.getByTestId("ranking-elapsed").innerText();
    const ms = Number(elapsedText.replace(/[^\d.]/g, ""));
    expect(ms).toBeLessThan(100);

    // Permalink reload keeps identical top rank
    await page.reload();
    await expect(page.locator(`tr[data-iso3="${top.iso3}"]`)).toHaveAttribute(
      "data-rank",
      "1",
      { timeout: 15_000 },
    );
  });

  test("public demo fixture has no TARIF/CULT and shows BYOD note", async ({
    page,
  }) => {
    const publicDemo = JSON.parse(
      readFileSync(join(here, "../public/meta/phase8_col_hs64.json"), "utf8"),
    ) as {
      block: {
        variables: { id: string }[];
        ranking_expert: { iso3: string; rank: number }[];
      };
    };
    const ids = new Set(publicDemo.block.variables.map((v) => v.id));
    expect(ids.has("TARIF")).toBe(false);
    expect(ids.has("CULT")).toBe(false);
    expect(ids.has("PLI")).toBe(true);
    expect(ids.has("CO2PC")).toBe(true);

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
    await expect(page.getByTestId("demo-byod-note")).toBeVisible();
    const top = publicDemo.block.ranking_expert[0]!;
    const second = publicDemo.block.ranking_expert[1]!;
    await expect(page.locator(`tr[data-iso3="${top.iso3}"]`)).toHaveAttribute(
      "data-rank",
      "1",
    );
    await expect(page.locator(`tr[data-iso3="${second.iso3}"]`)).toHaveAttribute(
      "data-rank",
      "2",
    );
  });

  test("permalink lang=es applies Spanish chrome", async ({ page }) => {
    const config = {
      v: 1,
      view: "home",
      lang: "es" as const,
    };
    await page.goto(`/?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.locator("footer.site-footer")).toContainText(
      "Desarrollado en el marco",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
