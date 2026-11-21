import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  HS2_PRODUCTS,
  HS_SEARCH_HIT_LIMIT,
  HS_TRADE_YEAR_MAX,
  analysisYearMax,
  clampTradeYear,
  ensureFullHsNomenclature,
  hsCategoryTree,
  hsLabel,
  searchHs,
  tradeYearOptions,
  type HsProduct,
} from "../data/hsProducts";
import { useTranslation } from "../i18n";
import {
  missingScopeFields,
  normalizeHsDraft,
  type ScopeSnapshot,
} from "../state/projectScope";
import { useAnalysis } from "../state/useAnalysis";
import { CountryPicker } from "./CountryPicker";

export type ProjectScopeFieldsHandle = {
  /** Commit drafts into analysis config; return the snapshot used for gating. */
  flush: () => ScopeSnapshot;
};

type Props = {
  highlightMissing?: boolean;
  onDraftChange?: (draft: {
    origin: string;
    hs: string;
    year: number | undefined;
  }) => void;
};

/**
 * Origin / product / year fields for the project-scope dialog.
 * Search-first product picker: never dumps the full nomenclature as a wall.
 */
export const ProjectScopeFields = forwardRef<ProjectScopeFieldsHandle, Props>(
  function ProjectScopeFields({ highlightMissing = false, onDraftChange }, ref) {
    const { t, i18n } = useTranslation();
    const lang = i18n.language.startsWith("es") ? "es" : "en";
    const { config, setConfig } = useAnalysis();
    const hsListId = useId();
    const hsInputRef = useRef<HTMLInputElement>(null);
    const treeScrollRef = useRef<HTMLDivElement>(null);

    const [origin, setOrigin] = useState(config.origin ?? "");
    const [hs, setHs] = useState(config.hs ?? "");
    const [year, setYear] = useState<number | undefined>(
      config.year != null ? clampTradeYear(config.year) : undefined,
    );

    useEffect(() => {
      onDraftChange?.({ origin, hs, year });
    }, [origin, hs, year, onDraftChange]);

    const [hsOpen, setHsOpen] = useState(false);
    const [hsQuery, setHsQuery] = useState("");
    const [hsActive, setHsActive] = useState(0);
    const [treeOpen, setTreeOpen] = useState(false);
    const [treeChapter, setTreeChapter] = useState<string | null>(null);
    /** Bumps when full HS4/HS6 nomenclature finishes loading. */
    const [hsCatalogGen, setHsCatalogGen] = useState(0);

    useEffect(() => {
      setOrigin(config.origin ?? "");
      setHs(config.hs ?? "");
      setYear(config.year != null ? clampTradeYear(config.year) : undefined);
    }, [config.origin, config.hs, config.year]);

    useEffect(() => {
      if (!hsOpen && !treeOpen) {
        setHsQuery("");
        return;
      }
      let cancelled = false;
      void ensureFullHsNomenclature()
        .then(() => {
          if (!cancelled) setHsCatalogGen((n) => n + 1);
        })
        .catch(() => {
          /* HS2-only fallback still works */
        });
      return () => {
        cancelled = true;
      };
    }, [hsOpen, treeOpen]);

    // Keep the selected HS2 chapter visible when the tree opens.
    useEffect(() => {
      if (!treeOpen || !hs) return;
      const chapter = hs.replace(/\D/g, "").slice(0, 2);
      if (chapter.length === 2) setTreeChapter(chapter);
      const id = window.setTimeout(() => {
        const active = treeScrollRef.current?.querySelector(
          ".hs-tree-row button.active, .hs-tree-children button.active",
        );
        active?.scrollIntoView({ block: "nearest" });
      }, 0);
      return () => window.clearTimeout(id);
    }, [treeOpen, hs, hsCatalogGen]);

    useImperativeHandle(ref, () => ({
      flush: () => {
        // Absorb a bare HS code still sitting in the open search box.
        const pendingHs = normalizeHsDraft(hsQuery);
        const nextHs = pendingHs ?? hs;
        if (pendingHs && pendingHs !== hs) setHs(pendingHs);
        const snap: ScopeSnapshot = {
          origin: origin || undefined,
          hs: nextHs || undefined,
          year: year != null ? clampTradeYear(year) : undefined,
        };
        setConfig({
          origin: snap.origin,
          hs: snap.hs,
          year: snap.year,
        });
        return snap;
      },
    }));

    const missing = highlightMissing
      ? new Set(missingScopeFields({ origin, hs, year }))
      : new Set<string>();

    const selectedHsLabel = hs ? hsLabel(hs, lang) : "";

    const hsHits = useMemo(() => {
      if (!hsOpen) return [] as HsProduct[];
      const q = hsQuery.trim();
      // Empty browse: all HS2 chapters (~96). Typed search: HS_SEARCH_HIT_LIMIT.
      return searchHs(hsQuery, lang, {
        limit: q ? HS_SEARCH_HIT_LIMIT : HS2_PRODUCTS.length,
        emptyMeans: q ? "all" : "hs2",
      });
      // hsCatalogGen: re-search when HS4/HS6 arrive
      // eslint-disable-next-line react-hooks/exhaustive-deps -- gen is intentional
    }, [hsOpen, hsQuery, lang, hsCatalogGen]);

    const hsTree = useMemo(() => {
      void hsCatalogGen;
      return hsCategoryTree();
    }, [hsCatalogGen]);
    const years = useMemo(() => tradeYearOptions(), []);
    const yearCap = useMemo(() => analysisYearMax(), []);
    const yearHint = t("scopeYearHint")
      .replace("{panelMax}", String(HS_TRADE_YEAR_MAX))
      .replace("{yearMax}", String(yearCap));

    function pickHs(code: string) {
      const normalized = normalizeHsDraft(code) ?? code;
      setHs(normalized);
      setHsOpen(false);
      setHsQuery("");
      setHsActive(0);
    }

    function clearHs() {
      setHs("");
      setHsQuery("");
      setTreeOpen(false);
      setHsOpen(true);
      void Promise.resolve().then(() => hsInputRef.current?.focus());
    }

    function onHsKeyDown(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!hsOpen) {
          setHsOpen(true);
          setTreeOpen(false);
        }
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
        <section
          className={`scope-section${missing.has("origin") ? " scope-missing" : ""}`}
          aria-labelledby="scope-origin-h"
        >
          <h3 id="scope-origin-h" className="scope-section-title">
            {t("origin")}
          </h3>
          <CountryPicker
            value={origin}
            testId="origin-picker"
            inputTestId="origin-input"
            hitsTestId="origin-hits"
            onChange={setOrigin}
          />
        </section>

        <section
          className={`scope-section${missing.has("hs") ? " scope-missing" : ""}`}
          aria-labelledby="scope-product-h"
        >
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
                  setTreeOpen(false);
                  setHsOpen(true);
                  setHsQuery("");
                  setHsActive(0);
                }}
                onChange={(e) => {
                  setTreeOpen(false);
                  setHsQuery(e.target.value);
                  setHsOpen(true);
                  setHsActive(0);
                }}
                onKeyDown={onHsKeyDown}
                onBlur={() => {
                  const digits = normalizeHsDraft(hsQuery);
                  if (hsOpen && digits) setHs(digits);
                  window.setTimeout(() => setHsOpen(false), 120);
                }}
              />
              {hs ? (
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
            <input type="hidden" data-testid="hs-input" value={hs} readOnly />
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
                        aria-selected={hs === p.code}
                        className={
                          i === hsActive || hs === p.code ? "active" : undefined
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
            onToggle={(e) => {
              const open = (e.target as HTMLDetailsElement).open;
              setTreeOpen(open);
              if (open) setHsOpen(false);
            }}
          >
            <summary>{t("hsCategoryTree")}</summary>
            <div className="hs-tree-scroll" ref={treeScrollRef}>
              <ul className="hs-tree-chapters">
                {hsTree.map((node) => {
                  const expanded = treeChapter === node.code;
                  const chapterActive =
                    hs === node.code || (hs.length > 2 && hs.startsWith(node.code));
                  return (
                    <li key={node.code}>
                      <div className="hs-tree-row">
                        <button
                          type="button"
                          className="hs-tree-toggle"
                          aria-expanded={expanded}
                          aria-label={
                            expanded ? t("scopeTreeCollapse") : t("scopeTreeExpand")
                          }
                          onClick={() => setTreeChapter(expanded ? null : node.code)}
                        >
                          {expanded ? "▾" : "▸"}
                        </button>
                        <button
                          type="button"
                          className={chapterActive ? "active" : undefined}
                          onClick={() => pickHs(node.code)}
                        >
                          <span className="hs-tree-code">{node.code}</span>
                          <span className="hs-tree-name">{node.name[lang]}</span>
                        </button>
                      </div>
                      {expanded ? (
                        <ul className="hs-tree-children">
                          {node.children.length === 0 ? (
                            <li className="muted small hs-tree-empty">
                              {t("scopeTreeNoChildren")}
                            </li>
                          ) : (
                            node.children.map((ch) => (
                              <li key={ch.code}>
                                <button
                                  type="button"
                                  className={hs === ch.code ? "active" : undefined}
                                  onClick={() => pickHs(ch.code)}
                                >
                                  <span className="hs-tree-code">{ch.code}</span>
                                  <span className="hs-tree-name">{ch.name[lang]}</span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </section>

        <section
          className={`scope-section${missing.has("year") ? " scope-missing" : ""}`}
          aria-labelledby="scope-year-h"
        >
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
            value={year ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setYear(v ? clampTradeYear(Number(v)) : undefined);
            }}
          >
            <option value="">{t("scopeYearPlaceholder")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <p className="muted small scope-hint" data-testid="scope-year-hint">
            {yearHint}
          </p>
        </section>
      </div>
    );
  },
);
