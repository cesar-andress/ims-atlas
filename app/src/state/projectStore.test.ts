import { describe, expect, it } from "vitest";
import {
  clearProjectStorage,
  exportProjectJson,
  importProjectJson,
  loadProjectFromStorage,
  saveProjectToStorage,
} from "./projectStore";
import type { AnalysisConfig } from "./schema";

describe("projectStore", () => {
  it("saves and loads from localStorage", () => {
    const store = new Map<string, string>();
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: ls,
      configurable: true,
    });

    clearProjectStorage();
    const config: AnalysisConfig = { v: 1, view: "catalog", year: 2020 };
    saveProjectToStorage(config, "demo");
    expect(loadProjectFromStorage()?.view).toBe("catalog");
    const json = exportProjectJson(config, "demo");
    clearProjectStorage();
    expect(loadProjectFromStorage()).toBeNull();
    const imported = importProjectJson(json);
    expect(imported.year).toBe(2020);
    expect(loadProjectFromStorage()?.year).toBe(2020);
  });
});
