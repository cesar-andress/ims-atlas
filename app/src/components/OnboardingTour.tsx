import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import { PermalinkLink } from "./PermalinkLink";

const KEY = "ims-atlas.onboarding.done";

const STEPS = [
  { titleKey: "tourStep1Title" as const, bodyKey: "tourStep1Body" as const },
  { titleKey: "tourStep2Title" as const, bodyKey: "tourStep2Body" as const },
  { titleKey: "tourStep3Title" as const, bodyKey: "tourStep3Body" as const },
  { titleKey: "tourStep4Title" as const, bodyKey: "tourStep4Body" as const },
];

/** Tour opens only on request (footer button) or when forceOpen; never blocks content. */
export function OnboardingTour({ forceOpen = false }: { forceOpen?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    // Do not auto-open over Análisis / first paint — user opens via "Tour (60 s)".
    if (typeof localStorage === "undefined") return;
    if (typeof navigator !== "undefined" && navigator.webdriver) {
      localStorage.setItem(KEY, "1");
    }
  }, [forceOpen]);

  function finish() {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="tour-reopen"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
      >
        {t("tourReopen")}
      </button>
    );
  }

  const s = STEPS[step]!;
  return (
    <div
      className="onboarding-overlay"
      data-testid="onboarding-tour"
      role="dialog"
      aria-modal="true"
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
            onClick={finish}
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
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="tour-next"
              onClick={() => setStep((x) => x + 1)}
            >
              {t("guidedNext")}
            </button>
          ) : (
            <PermalinkLink
              view="datos"
              className="btn btn-primary"
              data-testid="tour-start"
              onClick={finish}
            >
              {t("tourStart")}
            </PermalinkLink>
          )}
        </div>
      </div>
    </div>
  );
}
