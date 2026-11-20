import type { LandingLang } from "../i18n";

export function AvisoLegalPage({ lang }: { lang: LandingLang }) {
  const es = lang === "es";
  return (
    <article className="l-section l-wrap" data-testid="legal-view">
      <h1>{es ? "Aviso legal" : "Legal notice"}</h1>
      <div className="l-prose">
        <p>
          {es
            ? "Titular del sitio: AISERV SYSTEMS SLU (Madrid, España)."
            : "Site owner: AISERV SYSTEMS SLU (Madrid, Spain)."}
        </p>
        <p>
          <span className="l-marker" data-testid="legal-registry-marker">
            {es
              ? "[DATOS REGISTRALES — pendiente César]"
              : "[REGISTRY DETAILS — pending César]"}
          </span>
        </p>
        <h2>{es ? "Licencias de las fuentes de datos" : "Data source licences"}</h2>
        <p>
          {es
            ? "El detalle de licencias y derechos de cada fuente está en la página de fuentes dentro del área con sesión (después de Entrar)."
            : "Licence and rights detail for each source is on the sources page inside the signed-in area (after Sign in)."}
        </p>
        <p>
          <a href="/data/sources">
            {es ? "Ir a fuentes (requiere sesión)" : "Go to sources (sign-in required)"}
          </a>
        </p>
        <h2>{es ? "Software" : "Software"}</h2>
        <p>
          {es
            ? "IMS Atlas es software de AISERV SYSTEMS SLU. El uso del área de equipo queda reservado a personas autorizadas."
            : "IMS Atlas is software of AISERV SYSTEMS SLU. Team-area use is limited to authorised people."}
        </p>
      </div>
    </article>
  );
}
