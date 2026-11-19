import { useTranslation } from "react-i18next";

export function Home() {
  const { t } = useTranslation();

  return (
    <section className="hero" aria-labelledby="home-title">
      <h1 id="home-title">{t("appName")}</h1>
      <p>{t("tagline")}</p>
      <p className="note">{t("statusNote")}</p>
    </section>
  );
}
