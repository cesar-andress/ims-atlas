import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n";

type Props = {
  /** Sampled rankings: each sample is iso3 ordered best-first. */
  samples: string[][];
  /** Plain line for the current frame. */
  labelFor: (iso3: string, rank: number) => string;
};

/**
 * Hypothetical Outcome Plot: cycle through sampled rankings (Hullman et al.).
 * View-only animation — does not change analysis config.
 */
export function HopRanking({ samples, labelFor }: Props) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const n = samples.length;

  useEffect(() => {
    if (!playing || reduced || n < 2) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % n);
    }, 400);
    return () => window.clearInterval(id);
  }, [playing, reduced, n]);

  const top = useMemo(() => {
    const current = samples[frame % Math.max(1, n)] ?? [];
    return current.slice(0, 5);
  }, [samples, frame, n]);

  if (n === 0) {
    return (
      <p className="muted small" data-testid="hop-empty">
        {t("hopEmpty")}
      </p>
    );
  }

  return (
    <div className="hop-ranking" data-testid="hop-ranking">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="hop-toggle"
          onClick={() => setPlaying((p) => !p)}
          disabled={reduced || n < 2}
        >
          {playing ? t("hopPause") : t("hopPlay")}
        </button>
        <span className="muted small font-tabular" data-testid="hop-frame">
          {frame + 1}/{n}
        </span>
      </div>
      {reduced ? <p className="muted small">{t("hopReducedMotion")}</p> : null}
      <ol className="hop-list">
        {top.map((iso, i) => (
          <li key={`${frame}-${iso}`}>{labelFor(iso, i + 1)}</li>
        ))}
      </ol>
    </div>
  );
}
