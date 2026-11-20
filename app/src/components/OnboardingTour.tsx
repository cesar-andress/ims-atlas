import { useState } from "react";
import { useTranslation } from "../i18n";

const STEPS = [
  { titleKey: "tourStep1Title" as const, bodyKey: "tourStep1Body" as const },
  { titleKey: "tourStep2Title" as const, bodyKey: "tourStep2Body" as const },
  { titleKey: "tourStep3Title" as const, bodyKey: "tourStep3Body" as const },
];

/** Three-step walkthrough of the project flow, opened on request from Home. */
export function OnboardingTour({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  return (
    <div
      className="onboarding-overlay"
      data-testid="onboarding-tour"
      role="dialog"
      aria-modal="true"
      aria-label={t("homeTourOpen")}
    >
      <div className="onboarding-card">
        <p className="muted small font-tabular">
          {step + 1}/{STEPS.length}
        </p>
        <h2 className="m-0 text-lg font-semibold">{t(s.titleKey)}</h2>
        <p className="text-sm text-ink-2">{t(s.bodyKey)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="tour-skip"
            onClick={onClose}
          >
            {t("tourSkip")}
          </button>
          {step > 0 ? (
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="tour-back"
              onClick={() => setStep((x) => x - 1)}
            >
              {t("guidedBack")}
            </button>
          ) : null}
          {last ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="tour-done"
              onClick={onClose}
            >
              {t("tourDone")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="tour-next"
              onClick={() => setStep((x) => x + 1)}
            >
              {t("guidedNext")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
