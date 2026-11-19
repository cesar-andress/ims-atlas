import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeConfig } from "./_helpers";

const here = dirname(fileURLToPath(import.meta.url));
const publicStatus = join(here, "../public/status");

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(publicStatus, name), "utf8"));
}

function collectLeaves(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (value === null || value === undefined) return out;
  if (typeof value === "number" || typeof value === "boolean") {
    out.add(String(value));
    return out;
  }
  if (typeof value === "string") {
    out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLeaves(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectLeaves(v, out);
    }
  }
  return out;
}

test.describe("Phase 7b transparency", () => {
  test("status page loads JSON summary", async ({ page }) => {
    await page.goto(`/status?c=${encodeConfig({ v: 1, view: "status", lang: "en" })}`);
    await expect(page.getByTestId("data-status-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("status-summary")).toBeVisible();
    const index = loadJson("index.json") as { current_release: string };
    await expect(page.locator('[data-from-json="current_release"]')).toHaveText(
      index.current_release,
    );
  });

  test("sources table lists registry rows", async ({ page }) => {
    await page.goto(
      `/data/sources?c=${encodeConfig({ v: 1, view: "data_sources", lang: "en" })}`,
    );
    await expect(page.getByTestId("data-sources-view")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("sources-table")).toBeVisible();
    const sources = loadJson("sources.json") as { sources: { id: string }[] };
    const first = sources.sources[0]!.id;
    await expect(page.locator(`tr[data-source-id="${first}"]`)).toBeVisible();
  });

  test("variable detail shows gate from JSON", async ({ page }) => {
    await page.goto(
      `/data/variables/IMPV?c=${encodeConfig({
        v: 1,
        view: "data_variable",
        focusVariable: "IMPV",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("data-variable-view")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("variable-detail")).toHaveAttribute(
      "data-variable-id",
      "IMPV",
    );
    const vars = loadJson("variables.json") as {
      variables: { id: string; gate?: { decision?: string } }[];
    };
    const impv = vars.variables.find((v) => v.id === "IMPV")!;
    await expect(page.locator('[data-from-json="gate.decision"]')).toHaveText(
      String(impv.gate?.decision ?? "—"),
    );
  });

  test("pipeline page shows run log and edges", async ({ page }) => {
    await page.goto(
      `/data/pipeline?c=${encodeConfig({ v: 1, view: "data_pipeline", lang: "en" })}`,
    );
    await expect(page.getByTestId("data-pipeline-view")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("pipeline-run-log")).toBeVisible();
    await expect(page.getByTestId("pipeline-edges")).toBeVisible();
  });

  test("releases page shows current version", async ({ page }) => {
    await page.goto(
      `/data/releases?c=${encodeConfig({ v: 1, view: "data_releases", lang: "en" })}`,
    );
    await expect(page.getByTestId("data-releases-view")).toBeVisible({
      timeout: 15_000,
    });
    const releases = loadJson("releases.json") as { current: string };
    await expect(page.getByTestId("current-release")).toHaveText(releases.current);
  });

  test("no hand-written numbers on status page (data-from-json ⊆ JSON leaves)", async ({
    page,
  }) => {
    const index = loadJson("index.json");
    const qa = loadJson("qa.json");
    const freshness = loadJson("freshness.json");
    const run = loadJson("runs/latest.json");
    const leaves = collectLeaves({ index, qa, freshness, run });

    await page.goto(`/status?c=${encodeConfig({ v: 1, view: "status", lang: "en" })}`);
    await expect(page.getByTestId("status-summary")).toBeVisible({ timeout: 15_000 });

    const values = await page.locator("[data-from-json]").allTextContents();
    for (const raw of values) {
      const text = raw.trim();
      if (!text || text === "—") continue;
      expect(leaves.has(text), `unexpected value not in JSON: ${text}`).toBe(true);
    }
  });
});
