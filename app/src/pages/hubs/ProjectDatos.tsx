import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { useTranslation } from "../../i18n";
import { useProjectData, type DataAccess } from "../../state/useProjectData";

const ACCESS_KEY: Record<DataAccess, string> = {
  open: "datosAccessOpen",
  team: "datosAccessTeam",
  unknown: "datosAccessUnknown",
};

function formatDate(iso: string | null, lang: "en" | "es"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    dateStyle: "medium",
  }).format(d);
}

/** Step 1: one table with what each variable measures, where it comes from and how complete it is. */
export function ProjectDatos() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { loading, rows, warnings } = useProjectData();

  return (
    <PageShell testId="datos-hub" titleKey="datosTitle" className="project-datos">
      <p className="lead">{t("datosLead")}</p>

      {warnings.length > 0 ? (
        <ul className="callout warn datos-warnings" data-testid="datos-warnings">
          {warnings.map((w) => (
            <li key={w.id}>{w.text}</li>
          ))}
        </ul>
      ) : null}

      {loading ? <p className="muted">{t("loading")}</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="muted" data-testid="datos-vars-empty">
          {t("datosEmpty")}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="datos-table" data-testid="datos-table">
            <thead>
              <tr>
                <th scope="col">{t("datosColWhat")}</th>
                <th scope="col">{t("datosColSource")}</th>
                <th scope="col">{t("datosColAccess")}</th>
                <th scope="col">{t("datosColUpdated")}</th>
                <th scope="col">{t("datosColMarkets")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid={`datos-var-${r.id}`}>
                  <th scope="row">{r.name}</th>
                  <td>{r.sources}</td>
                  <td>
                    <span className={`pill access-${r.access}`}>
                      {t(ACCESS_KEY[r.access])}
                    </span>
                  </td>
                  <td>{formatDate(r.lastIngested, lang)}</td>
                  <td className="font-tabular">
                    {r.withData !== null && r.markets !== null
                      ? `${r.withData} / ${r.markets}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="datos-footnote muted small">{t("datosAccessNote")}</p>
      <p className="datos-byod" data-testid="datos-byod">
        {t("datosOwnData")}{" "}
        <PermalinkLink view="byod" data-testid="datos-byod-link">
          {t("datosUploadMine")}
        </PermalinkLink>
      </p>
    </PageShell>
  );
}
