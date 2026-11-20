import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

const CHART_FILES = [
  "components/StrategicScatter.tsx",
  "components/Top10Chart.tsx",
  "components/TornadoChart.tsx",
  "components/RankAcceptabilityChart.tsx",
] as const;

describe("ECharts onReady lifecycle (EXTRA-1)", () => {
  it("host hook never lists onReady as an effect dependency", () => {
    const host = readFileSync(join(here, "useEchartsHost.ts"), "utf8");
    expect(host).toContain("onReadyRef");
    expect(host).not.toMatch(/\}, \[onReady\]/);
  });

  it("chart components do not dispose on onReady identity churn", () => {
    for (const rel of CHART_FILES) {
      const src = readFileSync(join(srcRoot, rel), "utf8");
      expect(src, rel).not.toMatch(/\}, \[onReady\]\s*;/);
      expect(src, rel).toMatch(/useEchartsHost|onReadyRef/);
    }
  });
});
