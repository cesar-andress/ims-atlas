import { Link } from "react-router-dom";
import { LANDING_PUBLICATIONS, formatPublicationApa } from "../publications";
import { ATLAS_SOFTWARE_APA, ATLAS_SOFTWARE_BIBTEX } from "../softwareCite";
import type { LandingCopy } from "../i18n";

const ENTER_HREF = "/projects";

/** Intrinsic sizes from app/public/landing/*.png (do not invent pixels). */
const FLOW_SHOTS = [
  {
    src: "/landing/ranking.png",
    captionKey: "flowRankCaption" as const,
    testId: "landing-shot-ranking",
    width: 1280,
    height: 1605,
  },
  {
    src: "/landing/matriz.png",
    captionKey: "flowMatrixCaption" as const,
    testId: "landing-shot-matriz",
    width: 1280,
    height: 2651,
  },
  {
    src: "/landing/mapa.png",
    captionKey: "flowMapCaption" as const,
    testId: "landing-shot-mapa",
    width: 1280,
    height: 1605,
  },
];

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
      </section>

      <section className="l-section l-wrap" id="flujo" data-testid="landing-flow">
        <h2>{copy.flowTitle}</h2>
        <p className="l-prose">{copy.flowBody}</p>
        <div className="l-flow-shots">
          {FLOW_SHOTS.map((shot) => (
            <figure key={shot.src} className="l-shot" data-testid={shot.testId}>
              <img
                src={shot.src}
                alt={copy[shot.captionKey]}
                loading="lazy"
                width={shot.width}
                height={shot.height}
                decoding="async"
              />
              <figcaption>{copy[shot.captionKey]}</figcaption>
            </figure>
          ))}
        </div>
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

      <section
        className="l-section l-wrap"
        id="citar-software"
        data-testid="landing-cite-software"
      >
        <h2>{copy.citeSoftwareTitle}</h2>
        <p className="l-prose">{copy.citeSoftwareLead}</p>
        <p className="l-prose" data-testid="landing-cite-apa">
          {ATLAS_SOFTWARE_APA}
        </p>
        <pre className="l-bibtex" data-testid="landing-cite-bibtex">
          <code>{ATLAS_SOFTWARE_BIBTEX}</code>
        </pre>
      </section>

      <section className="l-section l-wrap" id="equipo" data-testid="landing-team">
        <h2>{copy.teamTitle}</h2>
        <p className="l-prose">{copy.teamNames}</p>
        {copy.teamAffil ? <p className="l-prose">{copy.teamAffil}</p> : null}
      </section>
    </>
  );
}
