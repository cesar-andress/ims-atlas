import { describe, expect, it } from "vitest";
import { collectSourceUrls, collectVariableSourceUrls } from "./sourceUrls";

describe("collectSourceUrls", () => {
  it("returns only real http(s) URLs from catalog fields", () => {
    const links = collectSourceUrls({
      id: "baci",
      landing_url:
        "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
      terms_url:
        "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
      licence_url:
        "https://www.etalab.gouv.fr/wp-content/uploads/2018/11/open-licence.pdf",
      endpoints: [
        {
          id: "zip_download",
          template: "https://www.cepii.fr/DATA_DOWNLOADS/BACI/{version}/",
        },
        { id: "bad", template: "UNKNOWN" },
        { id: "empty", template: "" },
      ],
    });
    expect(links.map((l) => l.kind)).toEqual([
      "landing",
      "terms",
      "licence",
      "download",
    ]);
    expect(links.every((l) => l.url.startsWith("http"))).toBe(true);
    expect(links.find((l) => l.kind === "download")?.endpointId).toBe(
      "zip_download",
    );
  });

  it("skips UNKNOWN and non-http values", () => {
    expect(
      collectSourceUrls({
        landing_url: "UNKNOWN",
        terms_url: "ftp://example.com/x",
        licence_url: null,
      }),
    ).toEqual([]);
  });
});

describe("collectVariableSourceUrls", () => {
  it("maps source ids without inventing missing sources", () => {
    const byId = new Map([
      [
        "baci",
        {
          id: "baci",
          landing_url: "https://www.cepii.fr/example",
        },
      ],
    ]);
    const rows = collectVariableSourceUrls(["baci", "missing"], byId);
    expect(rows[0]?.links).toHaveLength(1);
    expect(rows[1]).toEqual({ sourceId: "missing", links: [] });
  });
});
