import { Link } from "react-router-dom";
import { LANDING_PUBLICATIONS, formatPublicationApa } from "../publications";
import { ToolPreviewSvg } from "../ToolPreviewSvg";
import type { LandingCopy } from "../i18n";

const ENTER_HREF = "/projects";

export function HomeLanding({
  copy,
  showLoginHint,
}: {
  copy: LandingCopy;
  showLoginHint: boolean;
}) {
  return (
    <>
      <section className="l-hero l-wrap" data-testid="landing-hero">
        {showLoginHint ? (
          <p className="l-banner" role="status" data-testid="landing-login-hint">
            {copy.loginHint}
          </p>
        ) : null}
        <h1>{copy.heroTitle}</h1>
        <p>{copy.heroSub}</p>
        <div className="l-cta-row">
          <a
            className="l-btn l-btn-primary"
            href={ENTER_HREF}
            data-testid="landing-enter"
          >
            {copy.heroCta}
          </a>
          <Link
            className="l-btn l-btn-secondary"
            to="/metodologia"
            data-testid="landing-method-cta"
          >
            {copy.heroSecondary}
          </Link>
        </div>
      </section>

      <section
        className="l-section l-wrap"
        id="como-funciona"
        data-testid="landing-how"
      >
        <h2>{copy.howTitle}</h2>
        <div className="l-steps">
          <article className="l-step">
            <strong>1. {copy.how1Title}</strong>
            <p>{copy.how1Body}</p>
          </article>
          <article className="l-step">
            <strong>2. {copy.how2Title}</strong>
            <p>{copy.how2Body}</p>
          </article>
          <article className="l-step">
            <strong>3. {copy.how3Title}</strong>
            <p>{copy.how3Body}</p>
          </article>
        </div>
        <figure className="l-shot">
          <ToolPreviewSvg />
          <figcaption>{copy.howCaption}</figcaption>
        </figure>
      </section>

      <section
        className="l-section l-wrap"
        id="metodologia-resumen"
        data-testid="landing-method"
      >
        <h2>{copy.methodTitle}</h2>
        <div className="l-prose">
          <p>{copy.methodBody}</p>
          <p>
            <Link to="/metodologia">{copy.heroSecondary}</Link>
          </p>
        </div>
      </section>

      <section
        className="l-section l-wrap"
        id="publicaciones"
        data-testid="landing-pubs"
      >
        <h2>{copy.pubsTitle}</h2>
        <ol className="l-pubs">
          {LANDING_PUBLICATIONS.map((p) => (
            <li key={p.id} data-testid={`landing-pub-${p.id}`}>
              <a href={p.url} rel="noopener noreferrer" target="_blank">
                {p.title}
              </a>
              <span className="l-meta">{formatPublicationApa(p)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="l-section l-wrap" id="equipo" data-testid="landing-team">
        <h2>{copy.teamTitle}</h2>
        <p className="l-prose">{copy.teamNames}</p>
        {copy.teamAffil ? <p className="l-prose">{copy.teamAffil}</p> : null}
      </section>
    </>
  );
}
