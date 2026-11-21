import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  hsCategoryTree,
  hsLabel,
  searchHs,
  tradeYearOptions,
  type HsProduct,
} from "../data/hsProducts";
import { useTranslation } from "../i18n";
import { CountryPicker } from "./CountryPicker";

export type ScopeDraft = {
  origin: string;
  hs: string;
  year: number | undefined;
};

type Props = {
  value: ScopeDraft;
  onChange: (patch: Partial<ScopeDraft>) => void;
  /** Highlight incomplete fields after a failed Listo / Done. */
  highlightMissing?: boolean;
};

/**
 * Origin / product / year fields for the project-scope dialog.
 * Search-first product picker: never dumps the full nomenclature as a wall.
 */
export function ProjectScopeFields({
  value,
  onChange,
  highlightMissing = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const hsListId = useId();
  const hsInputRef = useRef<HTMLInputElement>(null);

  const [hsOpen, setHsOpen] = useState(false);
  const [hsQuery, setHsQuery] = useState("");
  const [hsActive, setHsActive] = useState(0);
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeChapter, setTreeChapter] = useState<string | null>(null);

  useEffect(() => {
    if (!hsOpen) setHsQuery("");
  }, [hsOpen]);

  const selectedHsLabel = value.hs ? hsLabel(value.hs, lang) : "";

  const hsHits = useMemo(() => {
    if (!hsOpen) return [] as HsProduct[];
    return searchHs(hsQuery, lang, {
      limit: 12,
      emptyMeans: hsQuery.trim() ? "all" : "hs2",
    }).slice(0, 12);
  }, [hsOpen, hsQuery, lang]);

  const hsTree = useMemo(() => hsCategoryTree(), []);
  const years = useMemo(() => tradeYearOptions(), []);

  function pickHs(code: string) {
    onChange({ hs: code });
    setHsOpen(false);
    setHsQuery("");
    setHsActive(0);
  }

  function clearHs() {
    onChange({ hs: "" });
    setHsQuery("");
    setHsOpen(true);
    queuePromise.resolve().then(() => hsInputRef.current?.focus());
  }

  function onHsKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!hsOpen) setHsOpen(true);
      setHsActive((i) => Math.min(i + 1, Math.max(hsHits.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHsActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = hsHits[hsActive];
      if (hit) pickHs(hit.code);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setHsOpen(false);
      setHsQuery("");
    }
  }

  return (
    <div className="scope-fields" data-testid="project-scope-fields">
      <section className="scope-section" aria-labelledby="scope-origin-h">
        <h3 id="scope-origin-h" className="scope-section-title">
          {t("origin")}
        </h3>
        <CountryPicker
          value={value.origin}
          testId="origin-picker"
          inputTestId="origin-input"
          hitsTestId="origin-hits"
          onChange={(iso) => onChange({ origin: iso })}
        />
      </section>

      <section className="scope-section" aria-labelledby="scope-product-h">
        <h3 id="scope-product-h" className="scope-section-title">
          {t("product")}
        </h3>
        <p className="muted small scope-hint">{t("scopeProductHint")}</p>
        <div className="m2o product-m2o" data-testid="hs-picker">
          <label className="scope-field-label" htmlFor="hs-search-input">
            {t("scopeProductSearch")}
          </label>
          <div className="m2o-control">
            <input
              id="hs-search-input"
              ref={hsInputRef}
              role="combobox"
              aria-expanded={hsOpen}
              aria-controls={hsListId}
              aria-autocomplete="list"
              className="m2o-input"
              value={hsOpen ? hsQuery : selectedHsLabel}
              placeholder={t("scopeProductPlaceholder")}
              data-testid="hs-search"
              autoComplete="off"
              onFocus={() => {
                setHsOpen(true);
                setHsQuery("");
                setHsActive(0);
              }}
              onChange={(e) => {
                const raw = e.target.value;
                setHsQuery(raw);
                setHsOpen(true);
                setHsActive(0);
                // Allow typing a raw HS code directly into the closed field path.
                const digits = raw.replace(/\D/g, "").slice(0, 6);
                if (
                  digits.length === 2 ||
                  digits.length === 4 ||
                  digits.length === 6
                ) {
                  // Keep as draft query only; commit on pick / blur digits below.
                }
              }}
              onKeyDown={onHsKeyDown}
              onBlur={() => {
                const digits = hsQuery.replace(/\D/g, "").slice(0, 6);
                if (
                  hsOpen &&
                  (digits.length === 2 ||
                    digits.length === 4 ||
                    digits.length === 6)
                ) {
                  onChange({ hs: digits });
                }
                window.setTimeout(() => setHsOpen(false), 120);
              }}
            />
            {value.hs ? (
              <button
                type="button"
                className="m2o-clear"
                data-testid="hs-clear"
                aria-label={t("scopeClearProduct")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearHs}
              >
                ×
              </button>
            ) : null}
          </div>
          {/* Hidden mirror for e2e that still fill hs-input */}
          <input
            type="hidden"
            data-testid="hs-input"
            value={value.hs}
            readOnly
          />
          {hsOpen ? (
            <ul
              id={hsListId}
              className="m2o-list hs-hits"
              role="listbox"
              data-testid="hs-hits"
            >
              {hsHits.length === 0 ? (
                <li className="m2o-empty muted small">{t("scopeNoHsHits")}</li>
              ) : (
                hsHits.map((p, i) => (
                  <li key={p.code} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value.hs === p.code}
                      className={
                        i === hsActive || value.hs === p.code
                          ? "active"
                          : undefined
                      }
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickHs(p.code)}
                      onMouseEnter={() => setHsActive(i)}
                    >
                      <span className="m2o-code">{p.code}</span>
                      <span className="m2o-name">{p.name[lang]}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        <details
          className="hs-tree"
          data-testid="hs-category-tree"
          open={treeOpen}
          onToggle={(e) => setTreeOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>{t("hsCategoryTree")}</summary>
          <div className="hs-tree-scroll">
            <ul className="hs-tree-chapters">
              {hsTree.map((node) => {
                const expanded = treeChapter === node.code;
                return (
                  <li key={node.code}>
                    <div className="hs-tree-row">
                      <button
                        type="button"
                        className="hs-tree-toggle"
                        aria-expanded={expanded}
                        onClick={() =>
                          setTreeChapter(expanded ? null : node.code)
                        }
                      >
                        {expanded ? "▾" : "▸"}
                      </button>
                      <button
                        type="button"
                        className={
                          value.hs === node.code ? "active" : undefined
                        }
                        onClick={() => pickHs(node.code)}
                      >
                        {node.code}: {node.name[lang]}
                      </button>
                    </div>
                    {expanded ? (
                      <ul className="hs-tree-children">
                        {node.children.slice(0, 40).map((ch) => (
                          <li key={ch.code}>
                            <button
                              type="button"
                              className={
                                value.hs === ch.code ? "active" : undefined
                              }
                              onClick={() => pickHs(ch.code)}
                            >
                              {ch.code}: {ch.name[lang]}
                            </button>
                          </li>
                        ))}
                        {node.children.length > 40 ? (
                          <li className="muted small">
                            {t("scopeTreeMore").replace(
                              "{n}",
                              String(node.children.length - 40),
                            )}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
      </section>

      <section className="scope-section" aria-labelledby="scope-year-h">
        <h3 id="scope-year-h" className="scope-section-title">
          {t("year")}
        </h3>
        <label className="scope-field-label" htmlFor="scope-year-select">
          {t("scopeYearLabel")}
        </label>
        <select
          id="scope-year-select"
          className="scope-year-select"
          data-testid="year-input"
          value={value.year ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ year: v ? Number(v) : undefined });
          }}
        >
          <option value="">{t("scopeYearPlaceholder")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}
