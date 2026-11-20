import { useEffect, useMemo, useState } from "react";
import { searchOrigins } from "../data/iso3Exporters";
import { countryLabel } from "../design/formatLocale";
import { useTranslation } from "../i18n";

/** Rough ISO3 → regional indicator flag (emoji). Unknown → 🌐 */
function flagEmoji(iso3: string): string {
  const a2: Record<string, string> = {
    COL: "CO",
    USA: "US",
    DEU: "DE",
    ESP: "ES",
    FRA: "FR",
    GBR: "GB",
    CHN: "CN",
    BRA: "BR",
    MEX: "MX",
    CZE: "CZ",
    NLD: "NL",
    ITA: "IT",
    JPN: "JP",
    CAN: "CA",
    AUS: "AU",
    IND: "IN",
    POL: "PL",
    TUR: "TR",
    BEL: "BE",
    CHE: "CH",
    AUT: "AT",
    SWE: "SE",
    NOR: "NO",
    DNK: "DK",
    FIN: "FI",
    PRT: "PT",
    IRL: "IE",
    KOR: "KR",
    ARG: "AR",
    CHL: "CL",
    PER: "PE",
  };
  const cc = a2[iso3.toUpperCase()];
  if (!cc || cc.length !== 2) return "🌐";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

type Props = {
  value: string;
  onChange: (iso3: string) => void;
  testId?: string;
  inputTestId?: string;
  hitsTestId?: string;
};

/** Searchable origin picker: flag · name · ISO3. */
export function CountryPicker({
  value,
  onChange,
  testId = "country-picker",
  inputTestId,
  hitsTestId = "origin-hits",
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const [q, setQ] = useState(value);
  useEffect(() => {
    setQ(value);
  }, [value]);

  const hits = useMemo(() => searchOrigins(q).slice(0, 12), [q]);

  return (
    <div className="country-picker" data-testid={testId}>
      <label className="block text-sm">
        {t("origin")}
        <input
          value={q}
          maxLength={48}
          data-testid={inputTestId ?? `${testId}-input`}
          placeholder="COL / Colombia"
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            setQ(next);
            const iso = next.replace(/[^A-Z]/g, "").slice(0, 3);
            if (iso.length === 3) onChange(iso);
          }}
          onBlur={() => {
            const v = q
              .trim()
              .toUpperCase()
              .replace(/[^A-Z]/g, "")
              .slice(0, 3);
            if (/^[A-Z]{3}$/.test(v)) {
              setQ(v);
              onChange(v);
            }
          }}
        />
      </label>
      {hits.length > 0 && q.length > 0 ? (
        <ul className="country-picker-hits hs-hits" data-testid={hitsTestId}>
          {hits.map((iso) => (
            <li key={iso}>
              <button
                type="button"
                className={value === iso ? "active" : undefined}
                onClick={() => {
                  setQ(iso);
                  onChange(iso);
                }}
              >
                <span aria-hidden>{flagEmoji(iso)}</span> {countryLabel(iso, lang)}{" "}
                <code className="muted">{iso}</code>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
