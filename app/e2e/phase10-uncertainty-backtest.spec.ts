import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeConfig } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const t4 = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../public/meta/phase10_t4.json"),
    "utf8",
  ),
) as {
  focal_method: string;
  metrics: {
    method: string;
    metric: string;
    mean: number;
    target: string;
    horizon: number;
  }[];
  paired_lift: {
    baseline: string;
    delta_mean: number;
    target: string;
    horizon: number;
  }[];
  col_hs64: { horizon_k: number; mean_ndcg_at_10: number }[];
};

const focal = t4.metrics.find(
  (r) =>
    r.method === t4.focal_method &&
    r.metric === "ndcg@10" &&
    r.target === "intensive" &&
    r.horizon === 1,
)!;

const colH1 = t4.col_hs64.find((r) => r.horizon_k === 1)!;

const baseConfig = {
  v: 1,
  view: "uncertainty",
  origin: "COL",
  year: 2023,
  hs: "64",
  normalization: "minmax",
  mcdm: "wsm",
  weightScheme: "expert_mean",
  missingThreshold: 0.2,
  mapSeed: 42,
  lang: "en",
};

test.describe("Phase 10 uncertainty + backtest", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  test("SMAA view renders acceptability and P(top-1)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/uncertainty?c=${encodeConfig(baseConfig)}`);
    await expect(page.getByTestId("uncertainty-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("topk-prob-bars")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("smaa-acceptability-chart")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("ptop-table")).toBeVisible();
    await expect(page.getByTestId("tornado-table")).toBeVisible();
    const firstP1 = page.locator("[data-testid^=p1-]").first();
    await expect(firstP1).toBeVisible();
    const txt = await firstP1.textContent();
    expect(Number(txt)).toBeGreaterThan(0);
  });

  test("backtest T4 numbers match ims-backtest fixture for COL HS64 preset", async ({
    page,
  }) => {
    const config = {
      ...baseConfig,
      view: "backtest",
      backtestTarget: "intensive",
      backtestHorizon: 1,
    };
    await page.goto(`/backtest?c=${encodeConfig(config)}`);
    await expect(page.getByTestId("backtest-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("backtest-disclaimer")).toBeVisible();
    await expect(page.getByTestId("t4-metrics-table")).toBeVisible({ timeout: 30_000 });

    const meanAttr = await page
      .getByTestId("focal-ndcg-mean")
      .getAttribute("data-mean");
    expect(meanAttr).toBeTruthy();
    expect(Math.abs(Number(meanAttr) - focal.mean)).toBeLessThanOrEqual(1e-9);

    const liftImport = t4.paired_lift.find(
      (r) =>
        r.baseline === "import_volume" && r.target === "intensive" && r.horizon === 1,
    )!;
    const liftCell = page.locator('tr[data-baseline="import_volume"] [data-delta]');
    await expect(liftCell).toBeVisible();
    const delta = Number(await liftCell.getAttribute("data-delta"));
    expect(Math.abs(delta - liftImport.delta_mean)).toBeLessThanOrEqual(1e-9);

    const colAttr = await page
      .getByTestId("col-hs64-ndcg")
      .locator("[data-mean]")
      .getAttribute("data-mean");
    expect(Math.abs(Number(colAttr) - colH1.mean_ndcg_at_10)).toBeLessThanOrEqual(1e-9);
  });
});
