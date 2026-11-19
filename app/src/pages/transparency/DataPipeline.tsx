import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n";
import { TransparencyShell } from "../../components/TransparencyShell";
import { loadLatestRun, loadLineage } from "../../data/transparency";

type Edge = { from: string; to: string };

function nodeStatus(
  id: string,
  run: Record<string, unknown> | null,
): "ok" | "warn" | "unknown" {
  if (!run) return "unknown";
  const steps = run.steps;
  if (!steps || typeof steps !== "object") return "unknown";
  const stepEntries = Object.values(steps as Record<string, unknown>);
  for (const step of stepEntries) {
    if (!step || typeof step !== "object") continue;
    const st = (step as { status?: string }).status;
    if (st && st !== "ok") return "warn";
  }
  if (id.startsWith("source:") || id.startsWith("raw:") || id.startsWith("curated:")) {
    return run.status === "ok" ? "ok" : "warn";
  }
  return "unknown";
}

export function DataPipeline() {
  const { t } = useTranslation();
  const [edges, setEdges] = useState<Edge[] | null>(null);
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadLineage(), loadLatestRun()])
      .then(([lineage, latest]) => {
        if (cancelled) return;
        setEdges(lineage.edges ?? []);
        setRun(latest);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nodes = useMemo(() => {
    if (!edges) return [];
    const set = new Set<string>();
    for (const e of edges) {
      set.add(e.from);
      set.add(e.to);
    }
    return [...set].sort();
  }, [edges]);

  return (
    <TransparencyShell
      testId="data-pipeline-view"
      titleKey="nav.data_pipeline"
      introKey="transparencyPipelineIntro"
    >
      {error ? <p className="error">{error}</p> : null}
      {!edges || !run ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <>
          <section data-testid="pipeline-run-log">
            <h2>{t("transparencyLastRun")}</h2>
            <dl className="status-grid">
              <dt>run_id</dt>
              <dd data-from-json="run_id">{String(run.run_id)}</dd>
              <dt>status</dt>
              <dd data-from-json="status">{String(run.status)}</dd>
              <dt>started_at</dt>
              <dd data-from-json="started_at">{String(run.started_at)}</dd>
              <dt>ended_at</dt>
              <dd data-from-json="ended_at">{String(run.ended_at)}</dd>
            </dl>
            <h3>{t("transparencySteps")}</h3>
            <ul data-testid="pipeline-steps">
              {Object.entries((run.steps as Record<string, unknown>) ?? {}).map(
                ([name, step]) => {
                  const s = step as { status?: string; duration_s?: number };
                  return (
                    <li key={name}>
                      <code data-from-json="step.name">{name}</code>:{" "}
                      <span data-from-json="step.status">{String(s.status)}</span>
                      {s.duration_s !== undefined ? (
                        <>
                          {" "}
                          (<span data-from-json="step.duration_s">
                            {s.duration_s}
                          </span>{" "}
                          s)
                        </>
                      ) : null}
                    </li>
                  );
                },
              )}
            </ul>
          </section>

          <section>
            <h2>{t("transparencyDag")}</h2>
            <p className="muted small">
              {t("transparencyDagHint")}{" "}
              <span data-from-json="n_nodes">{nodes.length}</span> nodes /{" "}
              <span data-from-json="n_edges">{edges.length}</span> edges
            </p>
            <ul className="dag-nodes" data-testid="pipeline-nodes">
              {nodes.map((id) => (
                <li
                  key={id}
                  data-node-id={id}
                  data-node-status={nodeStatus(id, run)}
                  className={`dag-node status-${nodeStatus(id, run)}`}
                >
                  <span data-from-json="node.id">{id}</span>
                </li>
              ))}
            </ul>
            <div className="table-scroll">
              <table data-testid="pipeline-edges">
                <thead>
                  <tr>
                    <th>from</th>
                    <th>to</th>
                  </tr>
                </thead>
                <tbody>
                  {edges.slice(0, 80).map((e) => (
                    <tr key={`${e.from}->${e.to}`}>
                      <td data-from-json="edge.from">{e.from}</td>
                      <td data-from-json="edge.to">{e.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </TransparencyShell>
  );
}
