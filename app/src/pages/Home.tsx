import { useTranslation } from "react-i18next";
import { dataConfig, releaseUrl } from "../dataConfig";

export function Home() {
  const { t } = useTranslation();

  return (
    <section className="hero" aria-labelledby="home-title">
      <h1 id="home-title">{t("appName")}</h1>
      <p>{t("tagline")}</p>
      <p className="note">{t("statusNote")}</p>
      <p className="note">
        {t("dataRelease")}:{" "}
        <a href={releaseUrl("manifest.json")}>v{dataConfig.release_version}</a>
      </p>
    </section>
  );
}
