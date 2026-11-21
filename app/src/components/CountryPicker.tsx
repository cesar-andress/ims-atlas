import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { searchCountries } from "../data/countryYearGaps";
import { ISO3_EXPORTERS } from "../data/iso3Exporters";
import { countryLabel } from "../design/formatLocale";
import { useTranslation } from "../i18n";

type Props = {
  value: string;
  onChange: (iso3: string) => void;
  testId?: string;
  inputTestId?: string;
  hitsTestId?: string;
  /** When true, show a clear (×) control. */
  clearable?: boolean;
};

/**
 * Many2one-style country combobox: type-ahead by ISO3 or localized name,
 * listbox keyboard support, clear selection. Uses ISO3_EXPORTERS only.
 */
export function CountryPicker({
  value,
  onChange,
  testId = "country-picker",
  inputTestId,
  hitsTestId = "origin-hits",
  clearable = true,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const selectedLabel = value
    ? `${value} · ${countryLabel(value, lang)}`
    : "";

  const hits = useMemo(() => {
    if (!open) return [];
    if (!q.trim()) {
      // Browse: first exporters by ISO order (compact).
      return ISO3_EXPORTERS.slice(0, 12).map((iso3) => ({
        iso3,
        name: countryLabel(iso3, lang),
      }));
    }
    return searchCountries(q, lang, 12);
  }, [open, q, lang]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  function pick(iso3: string) {
    onChange(iso3);
    setOpen(false);
    setQ("");
    setActive(0);
  }

  function clear() {
    onChange("");
    setQ("");
    setOpen(true);
    setActive(0);
    queuePromise.resolve().then(() => inputRef.current?.focus());
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) pick(hit.iso3);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQ("");
    }
  }

  return (
    <div className="m2o country-m2o" data-testid={testId}>
      <label className="scope-field-label" htmlFor={`${testId}-input`}>
        {t("origin")}
      </label>
      <div className="m2o-control">
        <input
          id={`${testId}-input`}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && hits[active] ? `${listId}-${hits[active]!.iso3}` : undefined
          }
          className="m2o-input"
          value={open ? q : selectedLabel}
          placeholder={t("scopeOriginPlaceholder")}
          data-testid={inputTestId ?? `${testId}-input`}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setQ("");
            setActive(0);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // Defer so list button click can fire first.
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        {clearable && value ? (
          <button
            type="button"
            className="m2o-clear"
            data-testid={`${testId}-clear`}
            aria-label={t("scopeClearOrigin")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={listId}
          className="m2o-list"
          role="listbox"
          data-testid={hitsTestId}
        >
          {hits.length === 0 ? (
            <li className="m2o-empty muted small">{t("scopeNoCountryHits")}</li>
          ) : (
            hits.map((hit, i) => (
              <li key={hit.iso3} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${hit.iso3}`}
                  role="option"
                  aria-selected={value === hit.iso3}
                  className={
                    i === active || value === hit.iso3 ? "active" : undefined
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(hit.iso3)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="m2o-code">{hit.iso3}</span>
                  <span className="m2o-name">{hit.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
