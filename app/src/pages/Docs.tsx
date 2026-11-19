import { useTranslation } from "../i18n";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";

const SECTIONS = ["methods", "glossary", "tutorials", "faq"] as const;

/** In-app documentation (methods, glossary, tutorials, FAQ). */
export function Docs() {
  const { t } = useTranslation();

  return (
    <PageShell testId="docs-view" titleKey="nav.docs" className="docs-page">
      <p className="muted">{t("docsIntro")}</p>
      <p className="small">
        <a href="/privacidad">{t("nav.privacy")}</a>
      </p>
      <nav className="docs-toc" aria-label={t("docsToc")} data-testid="docs-toc">
        {SECTIONS.map((id) => (
          <a key={id} href={`#docs-${id}`}>
            {t(`docs.section.${id}`)}
          </a>
        ))}
      </nav>

      <section
        id="docs-methods"
        data-testid="docs-methods"
        aria-labelledby="docs-methods-h"
      >
        <h2 id="docs-methods-h">{t("docs.section.methods")}</h2>
        <p>{t("docs.methods.p1")}</p>
        <p>{t("docs.methods.p2")}</p>
        <h3>{t("docs.methods.normTitle")}</h3>
        <ul>
          <li>
            <strong>min–max</strong>: <code>x′ = (x − min) / (max − min)</code>{" "}
            {t("docs.methods.normCost")}
          </li>
          <li>
            <strong>z-score</strong>: <code>x′ = (x − μ) / σ</code>
          </li>
          <li>
            <strong>rank</strong>: {t("docs.methods.rankNorm")}
          </li>
        </ul>
        <h3>{t("docs.methods.aggTitle")}</h3>
        <p>
          WSM:{" "}
          <code>
            S<sub>i</sub> = Σ<sub>j</sub> w<sub>j</sub> · x′
            <sub>ij</sub>
          </code>
          . {t("docs.methods.aggOthers")}
        </p>
        <h3>{t("docs.methods.missingTitle")}</h3>
        <p>{t("docs.methods.missingBody")}</p>
        <h3>SMAA</h3>
        <p>{t("docs.methods.smaaBody")}</p>
        <h3 data-testid="docs-transport">{t("docs.methods.transportTitle")}</h3>
        <p>{t("docs.methods.transportBody")}</p>
        <h3 data-testid="docs-sustainability">
          {t("docs.methods.sustainabilityTitle")}
        </h3>
        <p>{t("docs.methods.sustainabilityBody")}</p>
        <h3 data-testid="docs-pli">{t("docs.methods.pliTitle")}</h3>
        <p>{t("docs.methods.pliBody")}</p>
        <h3 data-testid="docs-map">{t("docs.methods.mapTitle")}</h3>
        <p>{t("docs.methods.mapBody")}</p>
      </section>

      <section
        id="docs-glossary"
        data-testid="docs-glossary"
        aria-labelledby="docs-glossary-h"
      >
        <h2 id="docs-glossary-h">{t("docs.section.glossary")}</h2>
        <dl className="docs-glossary">
          <dt>IMS</dt>
          <dd>{t("docs.glossary.ims")}</dd>
          <dt>MCDM</dt>
          <dd>{t("docs.glossary.mcdm")}</dd>
          <dt>NDCG@k</dt>
          <dd>{t("docs.glossary.ndcg")}</dd>
          <dt>SMAA</dt>
          <dd>{t("docs.glossary.smaa")}</dd>
          <dt>BYOD</dt>
          <dd>{t("docs.glossary.byod")}</dd>
          <dt>HS</dt>
          <dd>{t("docs.glossary.hs")}</dd>
        </dl>
      </section>

      <section
        id="docs-tutorials"
        data-testid="docs-tutorials"
        aria-labelledby="docs-tutorials-h"
      >
        <h2 id="docs-tutorials-h">{t("docs.section.tutorials")}</h2>
        <article>
          <h3>{t("docs.tutorial.exporterTitle")}</h3>
          <ol>
            <li>{t("docs.tutorial.exporter1")}</li>
            <li>{t("docs.tutorial.exporter2")}</li>
            <li>{t("docs.tutorial.exporter3")}</li>
          </ol>
          <p>
            <PermalinkLink view="builder">{t("nav.builder")}</PermalinkLink>
          </p>
        </article>
        <article>
          <h3>{t("docs.tutorial.researcherTitle")}</h3>
          <ol>
            <li>{t("docs.tutorial.researcher1")}</li>
            <li>{t("docs.tutorial.researcher2")}</li>
            <li>{t("docs.tutorial.researcher3")}</li>
          </ol>
          <p>
            <PermalinkLink view="backtest">{t("nav.backtest")}</PermalinkLink>
            {" · "}
            <PermalinkLink view="uncertainty">{t("nav.uncertainty")}</PermalinkLink>
          </p>
        </article>
        <article>
          <h3>{t("docs.tutorial.agencyTitle")}</h3>
          <ol>
            <li>{t("docs.tutorial.agency1")}</li>
            <li>{t("docs.tutorial.agency2")}</li>
            <li>{t("docs.tutorial.agency3")}</li>
          </ol>
          <p>
            <PermalinkLink view="cite">{t("nav.cite")}</PermalinkLink>
          </p>
        </article>
      </section>

      <section id="docs-faq" data-testid="docs-faq" aria-labelledby="docs-faq-h">
        <h2 id="docs-faq-h">{t("docs.section.faq")}</h2>
        <h3>{t("docs.faq.q1")}</h3>
        <p>{t("docs.faq.a1")}</p>
        <h3>{t("docs.faq.q2")}</h3>
        <p>{t("docs.faq.a2")}</p>
        <h3>{t("docs.faq.q3")}</h3>
        <p>{t("docs.faq.a3")}</p>
        <h3>{t("docs.faq.q4")}</h3>
        <p>{t("docs.faq.a4")}</p>
      </section>
    </PageShell>
  );
}
