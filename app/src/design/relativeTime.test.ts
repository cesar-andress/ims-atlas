import { describe, expect, it } from "vitest";
import { formatProjectEditedAt } from "./relativeTime";

describe("formatProjectEditedAt", () => {
  it("labels today in Spanish", () => {
    const now = Date.parse("2026-11-21T21:00:00Z");
    const iso = "2026-11-21T09:18:00Z";
    expect(formatProjectEditedAt(iso, "es", now)).toMatch(/^hoy,/);
  });

  it("labels yesterday in English", () => {
    const now = Date.parse("2026-11-21T12:00:00Z");
    const iso = "2026-11-20T18:40:00Z";
    expect(formatProjectEditedAt(iso, "en", now)).toMatch(/^yesterday,/);
  });
});
