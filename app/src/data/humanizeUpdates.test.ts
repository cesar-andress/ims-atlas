import { describe, expect, it } from "vitest";
import {
  changelogBlocksForAppVersion,
  humanizeSummaryLine,
  sourceLabel,
  statusLabel,
} from "./humanizeUpdates";

describe("humanizeUpdates", () => {
  const pubs = new Map([
    ["cepi_gravity", "CEPII"],
    ["worldbank_wdi", "World Bank"],
  ]);

  it("labels sources with publisher", () => {
    expect(sourceLabel("cepi_gravity", pubs)).toBe("CEPII (cepi_gravity)");
    expect(sourceLabel("unknown_src", pubs)).toBe("unknown_src");
  });

  it("translates status", () => {
    expect(statusLabel("ok", "es")).toBe("Correcta");
    expect(statusLabel("failed", "es")).toBe("Fallida");
    expect(statusLabel("qa_blocked", "en")).toBe("QA blocked");
  });

  it("humanizes first ingest and unchanged lines", () => {
    expect(
      humanizeSummaryLine("cepi_gravity: first ingest (1592160 rows)", "es", pubs),
    ).toBe("CEPII (cepi_gravity): primera ingestión (1.592.160 filas)");
    expect(
      humanizeSummaryLine(
        "worldbank_wdi: unchanged (already on disk)",
        "es",
        pubs,
      ),
    ).toBe("World Bank (worldbank_wdi): sin cambios (ya en disco)");
  });

  it("keeps unknown lines intact", () => {
    expect(humanizeSummaryLine("custom note without pattern", "es", pubs)).toBe(
      "custom note without pattern",
    );
  });

  it("selects changelog blocks for the app version", () => {
    const blocks = [
      { heading: "[Unreleased]", body: "- a" },
      { heading: "[1.1.0] — 2026-11-20", body: "- b" },
      { heading: "[1.0.0] — 2026-11-19", body: "- c" },
    ];
    const picked = changelogBlocksForAppVersion(blocks, "1.1.0");
    expect(picked.map((b) => b.heading)).toEqual([
      "[Unreleased]",
      "[1.1.0] — 2026-11-20",
    ]);
  });
});
