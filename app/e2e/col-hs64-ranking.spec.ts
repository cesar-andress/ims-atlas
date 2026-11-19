import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const golden = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../core/fixtures/phase8/golden.json",
    ),
    "utf8",
  ),
) as {
  block: { ranking_expert: { iso3: string; score: number; rank: number }[] };
};

function encodeConfig(config: object): string {
  const json = JSON.stringify(config);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

test.describe("COL HS64 2023 IMSFE ranking", () => {
  test("builder → ranking matches ims-backtest top ranks", async ({ page }) => {
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
    const scoreText = await page.getByTestId(`score-${top.iso3}`).innerText();
    const score = Number(scoreText);
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
});
