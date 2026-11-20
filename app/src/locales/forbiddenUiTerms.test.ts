import { describe, expect, it } from "vitest";
import { en } from "./en";
import es from "./es";

type Dict = { readonly [key: string]: string | Dict };

/**
 * Terms replaced in the simplified UI (project flow). Plain-language equivalents:
 * BYOD -> Subir mis datos, Advanced tools -> Herramientas del equipo,
 * Release -> Versión de los datos, Pipeline status -> Estado de la actualización,
 * Catalogue -> Fuentes y datos, IMSFE import -> Importar libro Excel,
 * Verify AI candidates -> Revisar valores propuestos, preset -> ejemplo.
 */
const FORBIDDEN: readonly { name: string; pattern: RegExp }[] = [
  { name: "BYOD", pattern: /\bBYOD\b/i },
  { name: "Advanced tools", pattern: /advanced tools|herramientas avanzadas/i },
  { name: "Release", pattern: /\breleases?\b|\bpublicaci(?:ón|ones)\b/i },
  { name: "Pipeline status", pattern: /pipeline status|estado del pipeline/i },
  { name: "Catalogue", pattern: /\bcatalog(?:ue)?\b|\bcat[aá]logo\b/i },
  { name: "IMSFE import", pattern: /imsfe import|importar imsfe/i },
  {
    name: "Verify AI candidates",
    pattern: /verify ai candidates|verificar candidatos|ai verify/i,
  },
  { name: "Expert mode", pattern: /expert mode|modo experto/i },
  { name: "redistributable panel", pattern: /panel redistribu/i },
  { name: "preset", pattern: /\bpresets?\b/i },
  { name: "Data release pending", pattern: /data release pending/i },
];

describe("Spanish Resultados copy has no English leftovers", () => {
  it("es pending / illustrative strings stay Spanish", () => {
    const keys = [
      "dataReleasePending",
      "dataReleasePendingTradeOk",
      "dataReleasePendingDetail",
      "illustrativeBanner",
      "seeExample",
      "dataMissingLink",
    ] as const;
    for (const key of keys) {
      const value = (es as Dict)[key];
      expect(typeof value).toBe("string");
      expect(String(value)).not.toMatch(/data release pending|pending release/i);
      expect(String(value)).not.toMatch(/\bBACI\b.*missing|missing.*\bBACI\b/i);
    }
  });
});

/**
 * Key prefixes that are not main UI copy: the SQL console is reachable only from
 * the team tools and keeps its own gate wording. Keep this list short.
 */
const EXCLUDED_PREFIXES: readonly string[] = ["sql"];

function leaves(dict: Dict, prefix = ""): [string, string][] {
  return Object.entries(dict).flatMap(([k, v]) =>
    typeof v === "string"
      ? [[`${prefix}${k}`, v] as [string, string]]
      : leaves(v, `${prefix}${k}.`),
  );
}

describe("main UI strings avoid retired terminology", () => {
  for (const [lang, dict] of [
    ["en", en as Dict],
    ["es", es as Dict],
  ] as const) {
    it(`${lang}: no retired term in main UI strings`, () => {
      const offenders = leaves(dict)
        .filter(([key]) => !EXCLUDED_PREFIXES.some((p) => key.startsWith(p)))
        .flatMap(([key, value]) =>
          FORBIDDEN.filter((f) => f.pattern.test(value)).map(
            (f) => `${key} [${f.name}]: ${value.slice(0, 80)}`,
          ),
        );
      expect(offenders).toEqual([]);
    });
  }
});
