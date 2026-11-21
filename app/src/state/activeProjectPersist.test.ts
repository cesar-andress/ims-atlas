import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_PROJECT_ID_KEY,
  clearActiveProjectIdForTests,
  readActiveProjectId,
  writeActiveProjectId,
} from "./activeProjectPersist";

function installDomStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      cookie: "",
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
}

describe("activeProjectPersist", () => {
  beforeEach(() => {
    installDomStorage();
  });

  afterEach(() => {
    clearActiveProjectIdForTests();
  });

  it("round-trips id via localStorage", () => {
    writeActiveProjectId("proj-abc-123");
    expect(localStorage.getItem(ACTIVE_PROJECT_ID_KEY)).toBe("proj-abc-123");
    expect(readActiveProjectId()).toBe("proj-abc-123");
  });

  it("clears storage when id is null", () => {
    writeActiveProjectId("x");
    writeActiveProjectId(null);
    expect(readActiveProjectId()).toBeNull();
  });

  it("rejects unsafe ids", () => {
    writeActiveProjectId("bad id with spaces");
    expect(readActiveProjectId()).toBeNull();
  });
});
