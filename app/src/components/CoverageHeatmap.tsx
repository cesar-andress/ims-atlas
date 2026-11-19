import type { CatalogVariable } from "../data/types";

type Props = {
  variable: CatalogVariable;
};

/**
 * Country × year coverage grid. Null cells = unknown / not measured.
 * Uses coverage_demo placeholders until ETL heatmaps are wired over HTTP.
 */
export function CoverageHeatmap({ variable }: Props) {
  const coverage = variable.coverage_demo;
  if (!coverage || Object.keys(coverage).length === 0) {
    return <p className="muted">No coverage matrix for this variable yet.</p>;
  }
  const countries = Object.keys(coverage).sort();
  const years = [
    ...new Set(countries.flatMap((c) => Object.keys(coverage[c] ?? {}))),
  ].sort();
  return (
    <div className="heatmap-wrap" data-testid={`heatmap-${variable.id}`}>
      <table className="heatmap">
        <thead>
          <tr>
            <th scope="col">ISO3</th>
            {years.map((y) => (
              <th key={y} scope="col">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {countries.map((iso) => (
            <tr key={iso}>
              <th scope="row">{iso}</th>
              {years.map((y) => {
                const v = coverage[iso]?.[y];
                const cls =
                  v === null || v === undefined
                    ? "cell-unknown"
                    : v > 0
                      ? "cell-present"
                      : "cell-missing";
                return <td key={y} className={cls} title={`${iso} ${y}`} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted heatmap-legend">
        <span className="swatch cell-present" /> present{" "}
        <span className="swatch cell-missing" /> missing{" "}
        <span className="swatch cell-unknown" /> unknown
      </p>
    </div>
  );
}
