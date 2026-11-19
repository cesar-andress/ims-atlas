import { useMemo } from "react";
import { PageShell } from "../components/PageShell";
import { HelpButton } from "../components/HelpButton";
import { useTranslation } from "../i18n";
import rawChangelog from "../../../CHANGELOG.md?raw";

type Block = { heading: string; body: string };

function parseChangelog(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    if (!heading) return;
    blocks.push({ heading, body: body.join("\n").trim() });
    body = [];
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      heading = line.replace(/^##\s+/, "");
      continue;
    }
    if (heading) body.push(line);
  }
  flush();
  return blocks;
}

/** Changelog page generated from the repo CHANGELOG.md (Vite ?raw). */
export function Changelog() {
  const { t } = useTranslation();
  const blocks = useMemo(() => parseChangelog(rawChangelog), []);

  return (
    <PageShell
      testId="changelog-view"
      titleKey="nav.changelog"
      className="changelog-page"
      intro={t("changelogIntro")}
    >
      <div className="page-help-row">
        <HelpButton section="faq" />
      </div>
      <div data-testid="changelog-body">
        {blocks.map((b) => (
          <section key={b.heading} className="changelog-block">
            <h2>{b.heading}</h2>
            <pre className="changelog-pre">{b.body}</pre>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
