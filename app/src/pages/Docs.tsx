import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "../i18n";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { HelpButton } from "../components/HelpButton";
import { DOCS_SECTIONS } from "../help/docsSections";

/** In-app documentation (Phase N sections). */
export function Docs() {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  return (
    <PageShell testId="docs-view" titleKey="nav.docs" className="docs-page">
      <div className="page-help-row">
        <HelpButton section="getting_started" />
      </div>
      <p className="muted">{t("docsIntro")}</p>
      <p className="small">
        <PermalinkLink view="privacy">{t("nav.privacy")}</PermalinkLink>
        {" · "}
        <PermalinkLink view="paper">{t("nav.paper")}</PermalinkLink>
        {" · "}
        <PermalinkLink view="changelog">{t("nav.changelog")}</PermalinkLink>
      </p>
      <nav className="docs-toc" aria-label={t("docsToc")} data-testid="docs-toc">
        {DOCS_SECTIONS.map((id) => (
          <a key={id} href={`#docs-${id}`}>
            {t(`docs.section.${id}`)}
          </a>
        ))}
      </nav>

      <section
        id="docs-getting_started"
        data-testid="docs-getting-started"
        aria-labelledby="docs-getting-started-h"
      >
        <h2 id="docs-getting-started-h">{t("docs.section.getting_started")}</h2>
        <p>{t("docs.getting_started.p1")}</p>
        <ol>
          <li>{t("docs.getting_started.s1")}</li>
          <li>{t("docs.getting_started.s2")}</li>
          <li>{t("docs.getting_started.s3")}</li>
          <li>{t("docs.getting_started.s4")}</li>
          <li>{t("docs.getting_started.s5")}</li>
        </ol>
        <p className="small">
          <PermalinkLink view="variables">{t("nav.builder")}</PermalinkLink>
          {" · "}
          <PermalinkLink view="explore">{t("nav.explore")}</PermalinkLink>
        </p>
      </section>

      <section
        id="docs-non_experts"
        data-testid="docs-non-experts"
        aria-labelledby="docs-non-experts-h"
      >
        <h2 id="docs-non-experts-h">{t("docs.section.non_experts")}</h2>
        <p>{t("docs.non_experts.p1")}</p>
        <p>{t("docs.non_experts.example")}</p>
        <p className="small">
          <PermalinkLink view="ranking">{t("nav.ranking")}</PermalinkLink>
          {" · "}
          <PermalinkLink view="matrix">{t("nav.matrix")}</PermalinkLink>
        </p>
      </section>

      <section
        id="docs-researchers"
        data-testid="docs-researchers"
        aria-labelledby="docs-researchers-h"
      >
        <h2 id="docs-researchers-h">{t("docs.section.researchers")}</h2>
        <p>{t("docs.researchers.p1")}</p>
        <p>
          WSM:{" "}
          <code>
            S<sub>i</sub> = Σ<sub>j</sub> w<sub>j</sub> · x′
            <sub>ij</sub>
          </code>
        </p>
        <p>{t("docs.researchers.refs")}</p>
        <p className="small">
          <PermalinkLink view="paper">{t("nav.paper")}</PermalinkLink>
          {" · "}
          <PermalinkLink view="backtest">{t("nav.backtest")}</PermalinkLink>
        </p>
      </section>

      <section
        id="docs-imsfe_workflow"
        data-testid="docs-imsfe-workflow"
        aria-labelledby="docs-imsfe-workflow-h"
      >
        <h2 id="docs-imsfe-workflow-h">{t("docs.section.imsfe_workflow")}</h2>
        <ol>
          <li>
            {t("docs.imsfe.s1")}{" "}
            <PermalinkLink view="variables">{t("nav.builder")}</PermalinkLink>
          </li>
          <li>
            {t("docs.imsfe.s2")}{" "}
            <PermalinkLink view="project_variables">
              {t("nav.project_variables")}
            </PermalinkLink>
          </li>
          <li>
            {t("docs.imsfe.s3")}{" "}
            <PermalinkLink view="norm_lab">{t("nav.norm_lab")}</PermalinkLink>
          </li>
          <li>
            {t("docs.imsfe.s4")}{" "}
            <PermalinkLink view="ranking">{t("nav.ranking")}</PermalinkLink>
          </li>
          <li>
            {t("docs.imsfe.s5")}{" "}
            <PermalinkLink view="matrix">{t("nav.matrix")}</PermalinkLink>
          </li>
          <li>
            {t("docs.imsfe.s6")}{" "}
            <PermalinkLink view="cite">{t("nav.cite")}</PermalinkLink>
          </li>
        </ol>
      </section>

      <section
        id="docs-projects"
        data-testid="docs-projects"
        aria-labelledby="docs-projects-h"
      >
        <h2 id="docs-projects-h">{t("docs.section.projects")}</h2>
        <p>{t("docs.projects.p1")}</p>
        <ol>
          <li>{t("docs.projects.s1")}</li>
          <li>{t("docs.projects.s2")}</li>
          <li>{t("docs.projects.s3")}</li>
        </ol>
        <p className="small">
          <PermalinkLink view="projects">{t("nav.projects")}</PermalinkLink>
        </p>
      </section>

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
            <strong>ratio 0–10</strong>: {t("docs.methods.ratioNorm")}
          </li>
          <li>
            <strong>min–max</strong>: <code>x′ = (x − min) / (max − min)</code>{" "}
            {t("docs.methods.normCost")}
          </li>
          <li>
            <strong>z-score</strong>: <code>x′ = (x − μ) / σ</code>
          </li>
          <li>
            <strong>robust z</strong>: {t("docs.methods.robustZNorm")}
          </li>
          <li>
            <strong>rank</strong>: {t("docs.methods.rankNorm")}
          </li>
        </ul>
        <p className="small">
          <PermalinkLink view="norm_lab">{t("normLabOpen")}</PermalinkLink>
        </p>
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
        id="docs-why_normalize"
        data-testid="docs-why-normalize"
        aria-labelledby="docs-why-normalize-h"
      >
        <h2 id="docs-why-normalize-h">{t("docs.section.why_normalize")}</h2>
        <p>{t("docs.why.p1")}</p>
        <p>{t("docs.why.p2")}</p>
        <ol>
          <li>{t("docs.why.step1")}</li>
          <li>{t("docs.why.step2")}</li>
          <li>{t("docs.why.step3")}</li>
          <li>{t("docs.why.step4")}</li>
          <li>{t("docs.why.step5")}</li>
        </ol>
        <p>{t("docs.why.example")}</p>
        <p>{t("docs.why.corr")}</p>
        <p className="small">
          <PermalinkLink view="norm_lab">{t("normLabOpen")}</PermalinkLink>
        </p>
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
          <dt>{t("nav.byod")}</dt>
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
            <PermalinkLink view="variables">{t("nav.builder")}</PermalinkLink>
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

      <section
        id="docs-sources"
        data-testid="docs-sources"
        aria-labelledby="docs-sources-h"
      >
        <h2 id="docs-sources-h">{t("docs.section.sources")}</h2>
        <p>{t("docs.sources.p1")}</p>
        <p className="small">
          <PermalinkLink view="data_sources">{t("nav.data_sources")}</PermalinkLink>
          {" · "}
          <PermalinkLink view="catalog">{t("nav.catalog")}</PermalinkLink>
        </p>
      </section>

      <section id="docs-cite" data-testid="docs-cite" aria-labelledby="docs-cite-h">
        <h2 id="docs-cite-h">{t("docs.section.cite")}</h2>
        <p>{t("docs.cite.p1")}</p>
        <p className="small">
          <PermalinkLink view="cite">{t("nav.cite")}</PermalinkLink>
        </p>
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
        <h3>{t("docs.faq.limitsTitle")}</h3>
        <p>{t("docs.faq.limitsBody")}</p>
      </section>
    </PageShell>
  );
}
