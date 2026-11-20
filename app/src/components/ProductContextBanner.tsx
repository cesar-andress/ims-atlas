import { hsLabel } from "../data/hsProducts";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

/** Origin · HS · year · product name for analysis workspace pages. */
export function ProductContextBanner() {
  const { config } = useAnalysis();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const origin = config.origin ?? "-";
  const hs = config.hs ?? "-";
  const year = config.year !== undefined ? String(config.year) : "-";
  const product =
    config.hs !== undefined && config.hs !== "" ? hsLabel(config.hs, lang) : "-";

  return (
    <p className="product-context muted" data-testid="product-context">
      {origin} · HS {hs} · {year} · {product}
    </p>
  );
}
