import { useEffect, useMemo, useRef, useState } from "react";
import { loadCatalogPreview } from "../data/catalogLoader";
import {
  runGlobalSearch,
  SEARCH_GROUP_ORDER,
  type SearchHit,
  type SearchIndex,
} from "../data/globalSearch";
import { loadSources } from "../data/transparency";
import { useTranslation } from "../i18n";
import { listProjects } from "../state/projectIdb";
import type { ViewId } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";

function hashForHit(hit: SearchHit): string | undefined {
  if (hit.view !== "data_sources") return undefined;
  if (hit.focusVariable) return "catalogo";
  if (hit.group === "sources") return "fuentes";
  return "fuentes";
}

export function GlobalSearch() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { setConfig } = useAnalysis();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<SearchIndex>({
    variables: [],
    sources: [],
    projects: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([
      loadCatalogPreview(),
      loadSources().catch(() => ({ sources: [] })),
      listProjects().catch(() => []),
    ]).then(([cat, src, projects]) => {
      setIndex({
        variables: cat.variables,
        sources: src.sources.map((s) => ({
          id: s.id,
          ...(s.publisher ? { name: s.publisher } : {}),
        })),
        projects,
      });
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA" &&
        tag !== "SELECT"
      ) {
        e.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(() => runGlobalSearch(query, index, lang), [query, index, lang]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(hit: SearchHit) {
    const patch: Parameters<typeof setConfig>[0] = {
      view: hit.view as ViewId,
    };
    if (hit.focusVariable) patch.focusVariable = hit.focusVariable;
    if (hit.focusCountry) patch.focusCountry = hit.focusCountry;
    if (hit.hs) patch.hs = hit.hs;
    const hash = hashForHit(hit);
    setConfig(patch, hash !== undefined ? { hash } : undefined);
    setOpen(false);
    setQuery("");
  }

  const grouped = SEARCH_GROUP_ORDER.map((g) => ({
    group: g,
    items: hits.filter((h) => h.group === g),
  })).filter((g) => g.items.length > 0);

  const flat = grouped.flatMap((g) => g.items);

  return (
    <div className="global-search" data-testid="global-search">
      <button
        type="button"
        className="global-search-toggle"
        data-testid="global-search-open"
        aria-label={t("searchOpen")}
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {t("searchOpen")} <kbd>/</kbd>
      </button>
      {open ? (
        <form
          className="global-search-panel"
          role="dialog"
          aria-label={t("searchTitle")}
          onSubmit={(e) => {
            e.preventDefault();
            if (flat[active]) go(flat[active]!);
          }}
        >
          <input
            ref={inputRef}
            type="search"
            data-testid="global-search-input"
            value={query}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                // Always stop the browser from "submitting" / reloading.
                e.preventDefault();
                if (flat[active]) go(flat[active]!);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />
          <div className="global-search-results" data-testid="global-search-results">
            {query.trim() && flat.length === 0 ? (
              <p className="muted small">{t("searchEmpty")}</p>
            ) : null}
            {!query.trim() ? <p className="muted small">{t("searchHint")}</p> : null}
            {grouped.map((g) => (
              <div key={g.group}>
                <h3 className="small">{t(`searchGroup.${g.group}`)}</h3>
                <ul>
                  {g.items.map((hit) => {
                    const idx = flat.indexOf(hit);
                    return (
                      <li key={`${hit.group}-${hit.id}`}>
                        <button
                          type="button"
                          className={idx === active ? "active" : undefined}
                          data-testid={`search-hit-${hit.group}-${hit.id}`}
                          onClick={() => go(hit)}
                          onMouseEnter={() => setActive(idx)}
                        >
                          <span>{hit.label}</span>
                          {hit.sub ? (
                            <span className="muted small"> {hit.sub}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="small"
            onClick={() => setOpen(false)}
            data-testid="global-search-close"
          >
            {t("close")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
