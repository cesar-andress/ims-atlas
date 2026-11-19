/**
 * Quantile-style rank dots for SMAA (Kay et al., CHI 2016).
 * Each country row shows discrete “dots” for P(rank ≤ k) bands.
 */

type Row = {
  iso3: string;
  /** Probabilities for ranks 1..maxRank (length maxRank), summing ≤ 1. */
  rankProb: number[];
};

type Props = {
  rows: Row[];
  maxRank?: number;
  dotsPerRow?: number;
  caption?: string;
};

export function QuantileDotPlot({
  rows,
  maxRank = 10,
  dotsPerRow = 20,
  caption,
}: Props) {
  return (
    <div className="quantile-dot-plot" data-testid="quantile-dot-plot">
      {caption ? (
        <p className="muted small m-0 mb-2" data-testid="qdp-caption">
          {caption}
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => {
          const dots: number[] = [];
          for (let i = 0; i < dotsPerRow; i++) {
            const p = (i + 0.5) / dotsPerRow;
            let cum = 0;
            let rank = maxRank + 1;
            for (let r = 0; r < maxRank; r++) {
              cum += row.rankProb[r] ?? 0;
              if (p <= cum) {
                rank = r + 1;
                break;
              }
            }
            dots.push(rank);
          }
          return (
            <li
              key={row.iso3}
              className="flex items-center gap-3"
              data-testid={`qdp-row-${row.iso3}`}
            >
              <span className="w-12 font-mono text-xs font-semibold text-ink">
                {row.iso3}
              </span>
              <div
                className="flex flex-wrap gap-0.5"
                aria-label={`${row.iso3} rank quantile dots`}
              >
                {dots.map((rank, i) => {
                  const t = Math.min(
                    1,
                    Math.max(0, (rank - 1) / Math.max(1, maxRank - 1)),
                  );
                  const color = `hsl(${160 - t * 140} 55% ${42 + t * 8}%)`;
                  return (
                    <span
                      key={i}
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: color }}
                      title={`dot ${i + 1}: rank ~${rank}`}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
