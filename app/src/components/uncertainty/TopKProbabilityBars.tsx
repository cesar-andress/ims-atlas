type Row = {
  iso3: string;
  pTop5: number;
  pTop10: number;
};

type Props = {
  rows: Row[];
  /** Plain-language template; `{iso}` and `{n}` / `{of}` placeholders. */
  plainLine?: (iso: string, nOf100: number) => string;
};

/** Horizontal P(top-k) bars with discrete “n of 100” wording. */
export function TopKProbabilityBars({ rows, plainLine }: Props) {
  return (
    <div className="topk-prob-bars" data-testid="topk-prob-bars">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => {
          const n5 = Math.round(row.pTop5 * 100);
          const n10 = Math.round(row.pTop10 * 100);
          return (
            <li key={row.iso3} data-testid={`topk-row-${row.iso3}`}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">{row.iso3}</span>
                <span className="font-tabular text-ink-2">
                  top5 {n5}/100 · top10 {n10}/100
                </span>
              </div>
              {plainLine ? (
                <p className="m-0 mb-1 text-xs text-ink-3">{plainLine(row.iso3, n5)}</p>
              ) : null}
              <div className="h-2 overflow-hidden rounded-chip bg-border">
                <div
                  className="h-full rounded-chip bg-primary transition-all duration-micro"
                  style={{ width: `${Math.min(100, n10)}%` }}
                  title={`P(top 10)=${row.pTop10.toFixed(3)}`}
                />
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-chip bg-border">
                <div
                  className="h-full rounded-chip"
                  style={{
                    width: `${Math.min(100, n5)}%`,
                    background: "var(--crit-comm)",
                  }}
                  title={`P(top 5)=${row.pTop5.toFixed(3)}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
