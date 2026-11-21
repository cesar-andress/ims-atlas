import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const TOKENS = readFileSync(join(__dirname, "tokens.css"), "utf8");
const STYLES = readFileSync(join(ROOT, "styles.css"), "utf8");

/** Collect `--name:` declarations inside a CSS block. */
function varsInBlock(css: string, marker: string): Set<string> {
  const idx = css.indexOf(marker);
  expect(idx, `missing block ${marker}`).toBeGreaterThanOrEqual(0);
  const brace = css.indexOf("{", idx);
  let depth = 0;
  let end = brace;
  for (let i = brace; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(brace + 1, end);
  const names = new Set<string>();
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:/gi)) {
    names.add(m[1]!);
  }
  return names;
}

describe("design tokens light/dark consistency", () => {
  it("dark overrides only tokens already defined in light (no rogue names)", () => {
    const light = varsInBlock(TOKENS, '[data-theme="light"]');
    const dark = varsInBlock(TOKENS, '[data-theme="dark"]');
    const onlyDark = [...dark].filter((n) => !light.has(n)).sort();
    expect(onlyDark, `dark-only tokens: ${onlyDark.join(", ")}`).toEqual([]);
  });

  it("styles.css does not redeclare a competing theme palette", () => {
    expect(STYLES).not.toMatch(/\[data-theme=["']light["']\]\s*\{[^}]*--bg\s*:/);
    expect(STYLES).not.toMatch(/\[data-theme=["']dark["']\]\s*\{[^}]*--bg\s*:/);
  });

  it("keeps shared semantic tokens in both themes", () => {
    const light = varsInBlock(TOKENS, '[data-theme="light"]');
    const dark = varsInBlock(TOKENS, '[data-theme="dark"]');
    for (const name of [
      "present",
      "missing",
      "unknown",
      "notice-bg",
      "notice-fg",
      "primary",
      "accent",
      "ground",
      "surface",
      "ink",
      "border",
      "soft",
    ]) {
      expect(light.has(name), `light missing --${name}`).toBe(true);
      expect(dark.has(name), `dark missing --${name}`).toBe(true);
    }
  });
});

describe("layout full-width contracts", () => {
  it("main and .wrap use full width on desktop (no narrow max-width column)", () => {
    expect(STYLES).toMatch(/main\s*\{[^}]*max-width:\s*100%/s);
    expect(STYLES).toMatch(/\.wrap\s*\{[^}]*max-width:\s*100%/s);
    expect(STYLES).not.toMatch(/main\s*\{[^}]*max-width:\s*72rem/s);
    expect(STYLES).not.toMatch(/\.wrap\s*\{[^}]*max-width:\s*80rem/s);
  });

  it("uses the shared 900px layout breakpoint for desktop padding", () => {
    expect(TOKENS).toMatch(/@media\s*\(min-width:\s*900px\)/);
    expect(TOKENS).toContain("--page-inline-pad");
    expect(STYLES).toContain("var(--page-inline-pad");
  });

  it("keeps the mobile readonly banner at max-width 800px", () => {
    expect(STYLES).toMatch(
      /@media\s*\(max-width:\s*800px\)\s*\{[^}]*\.mobile-readonly-banner/s,
    );
  });
});
