import { useTranslation } from "../i18n";

const STEPS = [
  { id: 0, key: "guidedStepOrigin" as const },
  { id: 1, key: "guidedStepMarkets" as const },
  { id: 2, key: "guidedStepVariables" as const },
  { id: 3, key: "guidedStepWeights" as const },
  { id: 4, key: "guidedStepMethod" as const },
];

type Props = {
  step: number;
  expert: boolean;
  onStep: (n: number) => void;
  onExpert: (v: boolean) => void;
};

export function VariablesGuidedChrome({ step, expert, onStep, onExpert }: Props) {
  const { t } = useTranslation();
  const n = STEPS.length;
  const progress = ((step + 1) / n) * 100;

  return (
    <div className="variables-guided-chrome" data-testid="variables-guided-chrome">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="variables-expert-toggle"
            checked={expert}
            onChange={(e) => onExpert(e.target.checked)}
          />
          {t("variablesExpertMode")}
        </label>
        {!expert ? (
          <p className="muted small m-0" data-testid="guided-step-sentence">
            {t(STEPS[step]?.key ?? "guidedStepOrigin")}
          </p>
        ) : null}
      </div>
      {!expert ? (
        <>
          <div
            className="guided-progress"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={n}
            data-testid="guided-progress"
          >
            <div className="guided-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="guided-back"
              disabled={step <= 0}
              onClick={() => onStep(Math.max(0, step - 1))}
            >
              {t("guidedBack")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="guided-next"
              disabled={step >= n - 1}
              onClick={() => onStep(Math.min(n - 1, step + 1))}
            >
              {t("guidedNext")}
            </button>
            <span className="muted small font-tabular self-center">
              {step + 1}/{n}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
