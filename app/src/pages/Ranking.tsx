import { AnalysisPage } from "../components/AnalysisPage";
import { ResultsDashboard } from "../components/results/ResultsDashboard";
import { useRankingModel } from "../ranking/useRankingModelApi";

/** Ranking = GUI-0 read-only results dashboard (no editable controls). */
export function Ranking() {
  const { model, error } = useRankingModel();

  return (
    <AnalysisPage
      testId="ranking-view"
      titleKey="nav.ranking"
      model={model}
      error={error}
      chrome="results"
    >
      {(m) => (m ? <ResultsDashboard model={m} /> : null)}
    </AnalysisPage>
  );
}
