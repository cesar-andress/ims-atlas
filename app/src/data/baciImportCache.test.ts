import { describe, expect, it, beforeEach } from "vitest";
import {
  baciVolumesFor,
  getBaciImportCache,
  setBaciImportCache,
} from "./baciImportCache";

describe("baciImportCache", () => {
  beforeEach(() => {
    setBaciImportCache(null);
  });

  it("returns null when empty or mismatched hs/year", () => {
    expect(baciVolumesFor("64", 2023)).toBeNull();
    setBaciImportCache({
      hs2: "64",
      year: 2023,
      volumes: { USA: 10, DEU: 5 },
      source: "baci_release",
    });
    expect(baciVolumesFor("84", 2023)).toBeNull();
    expect(baciVolumesFor("64", 2022)).toBeNull();
    expect(baciVolumesFor(undefined, 2023)).toBeNull();
  });

  it("returns volumes for matching hs2/year only (no HS4 collapse)", () => {
    setBaciImportCache({
      hs2: "64",
      year: 2023,
      volumes: { USA: 10 },
      source: "baci_release",
    });
    expect(baciVolumesFor("64", 2023)).toEqual({ USA: 10 });
    expect(baciVolumesFor("6403", 2023)).toBeNull();
    expect(getBaciImportCache()?.source).toBe("baci_release");
  });

  it("ignores unavailable source", () => {
    setBaciImportCache({
      hs2: "64",
      year: 2023,
      volumes: {},
      source: "unavailable",
    });
    expect(baciVolumesFor("64", 2023)).toBeNull();
  });
});
