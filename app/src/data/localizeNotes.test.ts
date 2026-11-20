import { describe, expect, it } from "vitest";
import { localizeNotes } from "./catalogLoader";

describe("localizeNotes", () => {
  it("picks the active language from bilingual notes", () => {
    expect(
      localizeNotes(
        { en: "Aggregate destination imports.", es: "Importaciones agregadas." },
        "es",
      ),
    ).toBe("Importaciones agregadas.");
    expect(
      localizeNotes(
        { en: "Aggregate destination imports.", es: "Importaciones agregadas." },
        "en",
      ),
    ).toBe("Aggregate destination imports.");
  });

  it("falls back across languages and ignores empty strings", () => {
    expect(localizeNotes({ en: "Only English", es: "" }, "es")).toBe(
      "Only English",
    );
    expect(localizeNotes("Plain note", "es")).toBe("Plain note");
    expect(localizeNotes(undefined, "es")).toBeNull();
  });
});
