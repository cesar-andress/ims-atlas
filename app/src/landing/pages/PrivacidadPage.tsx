import type { LandingLang } from "../i18n";

export function PrivacidadPage({ lang }: { lang: LandingLang }) {
  const es = lang === "es";
  return (
    <article className="l-section l-wrap" data-testid="privacy-view">
      <h1>{es ? "Privacidad" : "Privacy"}</h1>
      <div className="l-prose">
        <p>
          {es
            ? "Responsable del tratamiento: AISERV SYSTEMS SLU (Madrid, España)."
            : "Data controller: AISERV SYSTEMS SLU (Madrid, Spain)."}
        </p>
        <h2>{es ? "Qué datos se tratan" : "What is processed"}</h2>
        <p>
          {es
            ? "Cuenta de acceso del equipo (usuario, nombre y correo en Authelia) y registros técnicos del servidor y de Authelia: dirección IP, fecha y hora, y ruta solicitada."
            : "Team access account (username, name and email in Authelia) and technical logs from the server and Authelia: IP address, date and time, and requested path."}
        </p>
        <h2>{es ? "Para qué" : "Purpose"}</h2>
        <p>
          {es
            ? "Permitir el acceso a la herramienta y proteger la seguridad del servicio."
            : "To allow access to the tool and to protect the security of the service."}
        </p>
        <h2>{es ? "Base jurídica" : "Legal basis"}</h2>
        <p>
          {es
            ? "Interés legítimo y relación con el equipo de investigación / desarrollo."
            : "Legitimate interest and relationship with the research / development team."}
        </p>
        <h2>{es ? "Conservación" : "Retention"}</h2>
        <p>
          {es
            ? "Los registros técnicos se conservan 90 días (alineado con la política de retención del servicio)."
            : "Technical logs are kept for 90 days (aligned with the service retention policy)."}
        </p>
        <h2>{es ? "Proyectos del equipo" : "Team projects"}</h2>
        <p>
          {es
            ? "Con sesión de equipo activa, los proyectos de análisis se guardan en el servidor (SQLite) y son visibles para todo el equipo autorizado, junto con el identificador de quien crea o edita. Sin sesión, o como copia de respaldo, también pueden guardarse en el navegador (IndexedDB)."
            : "With an active team session, analysis projects are stored on the server (SQLite) and are visible to the whole authorised team, together with the identifier of who creates or edits them. Without a session, or as a backup copy, they may also be kept in the browser (IndexedDB)."}
        </p>
        <h2>{es ? "Cookies" : "Cookies"}</h2>
        <p>
          {es
            ? "No usamos cookies de publicidad ni de analítica de terceros. Solo la cookie de sesión de Authelia, estrictamente necesaria para el acceso. Por eso no mostramos un banner de cookies."
            : "We do not use advertising or third-party analytics cookies. Only the Authelia session cookie, strictly necessary for access. That is why there is no cookie banner."}
        </p>
        <h2>{es ? "Derechos" : "Rights"}</h2>
        <p>
          {es
            ? "Puede ejercer los derechos de acceso, rectificación, borrado, oposición y limitación del tratamiento contactando a:"
            : "You may exercise access, rectification, erasure, objection and restriction rights by contacting:"}
        </p>
        <p>
          <span className="l-marker" data-testid="privacy-contact-marker">
            [CONTACTO PRIVACIDAD: pendiente César]
          </span>
        </p>
      </div>
    </article>
  );
}
