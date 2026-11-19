import { useTranslation } from "react-i18next";
import { version } from "@ims-atlas/core";

export function Home() {
  const { t } = useTranslation();

  return (
    <section className="hero" aria-labelledby="home-title">
      <h1 id="home-title">{t("appName")}</h1>
      <p>{t("tagline")}</p>
      <p className="note">
        {t("placeholder")} (core {version})
      </p>
    </section>
  );
}
