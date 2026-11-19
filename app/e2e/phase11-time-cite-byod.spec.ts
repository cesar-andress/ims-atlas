import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeConfig } from "./_helpers";

const ranks = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../public/meta/phase11_rank_years.json",
    ),
    "utf8",
  ),
) as {
  focus_iso3: string[];
  rankings: Record<string, { iso3: string; rank: number }[]>;
};

const top2023 = [...ranks.rankings["2023"]!].sort((a, b) => a.rank - b.rank)[0]!;

const base = {
  v: 1,
  origin: "COL",
  year: 2023,
  hs: "64",
  normalization: "minmax",
  mcdm: "wsm",
  weightScheme: "expert_mean",
  missingThreshold: 0.2,
  lang: "en",
};

test.describe("Phase 11 time / cite / byod", () => {
  test("bump chart shows multi-year ranks for focus countries", async ({ page }) => {
    await page.goto(`/time?c=${encodeConfig({ ...base, view: "time" })}`);
    await expect(page.getByTestId("time-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("bump-chart")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("bump-table")).toBeVisible();
    await expect(page.locator(`tr[data-iso3="${ranks.focus_iso3[0]}"]`)).toBeVisible();
    await expect(page.getByTestId("time-provenance")).toContainText("imsfe");
  });

  test("cite view shows hash, APA, and pending DOI", async ({ page }) => {
    await page.goto(`/cite?c=${encodeConfig({ ...base, view: "cite" })}`);
    await expect(page.getByTestId("cite-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("cite-body")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("doi-placeholders")).toContainText("DOI-PENDING");
    await expect(page.getByTestId("cite-apa")).toContainText("IMS Atlas");
    const hash = await page.getByTestId("config-hash").locator("code").textContent();
    expect(hash && hash.length).toBe(64);
  });

  test("BYOD upload stays local (no fetch with CSV body)", async ({ page }) => {
    const requests: { url: string; postData: string | null }[] = [];
    page.on("request", (req) => {
      requests.push({ url: req.url(), postData: req.postData() });
    });
    await page.goto(`/byod?c=${encodeConfig({ ...base, view: "byod" })}`);
    await expect(page.getByTestId("byod-view")).toBeVisible();
    await expect(page.getByTestId("byod-local-only")).toBeVisible();

    await page.getByTestId("byod-id").fill("DEMOBYOD");
    const csv = "iso3,year,value\nESP,2020,1.2\nFRA,2020,2.3\n";
    await page.getByTestId("byod-file").setInputFiles({
      name: "demo.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await expect(page.locator('[data-byod-id="DEMOBYOD"]')).toBeVisible({
      timeout: 10_000,
    });

    const leaked = requests.filter(
      (r) =>
        r.postData && (r.postData.includes("DEMOBYOD") || r.postData.includes("1.2")),
    );
    expect(leaked).toHaveLength(0);
  });

  test("2023 fixture top rank is stable", async () => {
    expect(top2023.iso3).toBe("NLD");
    expect(top2023.rank).toBe(1);
  });
});
