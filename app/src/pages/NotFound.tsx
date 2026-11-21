import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useTranslation } from "../i18n";

/** Catch-all for unknown app routes (B2). */
export function NotFound() {
  const { t } = useTranslation();
  return (
    <PageShell testId="not-found" titleKey="notFoundTitle">
      <p className="lead" data-testid="not-found-body">
        {t("notFoundBody")}
      </p>
      <p>
        <Link to="/inicio" className="btn btn-primary" data-testid="not-found-home">
          {t("notFoundHome")}
        </Link>
      </p>
    </PageShell>
  );
}
