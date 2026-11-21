import { useCallback, useEffect, useState } from "react";
import { useAccessSession } from "../auth/accessSession";
import { OnboardingTour } from "../components/OnboardingTour";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { hsLabel } from "../data/hsProducts";
import { countryLabel } from "../design/formatLocale";
import { formatProjectEditedAt } from "../design/relativeTime";
import { useTranslation } from "../i18n";
import {
  createEmptyProject,
  plainErrorMessage,
  type ProjectListItem,
} from "../state/projectModel";
import {
  getLibraryStatus,
  getProject,
  listProjects,
  uploadLocalProjectsToTeam,
  upsertProject,
} from "../state/projectLibrary";
import { importAtlasProjectJson, prepareImportedProject } from "../state/projectStore";
import { COL_HS64_PRESET, EMPTY_PROJECT_CONFIG } from "../state/schema";
import { requestOpenScope } from "../state/projectScope";
import { useAnalysis } from "../state/useAnalysis";
import { preferredProjectView } from "../state/views";

const EXAMPLE_SEEDED_KEY = "ims-atlas.example-seeded";
const FIRST_VISIT_KEY = "ims-atlas.first-visit-dismissed";

function readFlag(key: string): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, "1");
  } catch {
    /* blocked storage: the hint may show again next visit */
  }
}

/** Shared across StrictMode double effects so the example is created once. */
let seedLock: Promise<void> | null = null;

/** First visit with an empty library: create the worked example project once. */
async function seedExampleOnce(name: string, lang: "en" | "es"): Promise<void> {
  if (readFlag(EXAMPLE_SEEDED_KEY)) return;
  seedLock ??= (async () => {
    await getLibraryStatus();
    const existing = await listProjects();
    if (existing.length === 0) {
      const config = {
        ...COL_HS64_PRESET,
        view: "analisis" as const,
        lang,
      };
      await upsertProject(
        createEmptyProject({
          name,
          config,
          isExample: true,
          ...(config.year !== undefined
            ? { yearFrom: config.year, yearTo: config.year }
            : {}),
        }),
      );
    }
    writeFlag(EXAMPLE_SEEDED_KEY);
  })().finally(() => {
    seedLock = null;
  });
  await seedLock;
}

function ProjectCard({
  item,
  lang,
  onOpen,
}: {
  item: ProjectListItem;
  lang: "en" | "es";
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const scope = [
    item.origin ? countryLabel(item.origin, lang) : null,
    item.hs ? hsLabel(item.hs, lang) : null,
    item.yearFrom !== undefined ? String(item.yearFrom) : null,
  ].filter((x): x is string => x !== null);
  const edited = formatProjectEditedAt(item.updatedAt, lang);
  return (
    <button
      type="button"
      className="card proj"
      data-testid={`project-card-${item.id}`}
      data-example={item.isExample ? "1" : "0"}
      onClick={() => onOpen(item.id)}
    >
      <h2>
        {item.name}
        {item.isExample ? (
          <span className="saved example" data-testid="project-card-example">
            {t("projectExample")}
          </span>
        ) : null}
      </h2>
      <p>{scope.length > 0 ? scope.join(" · ") : t("projectScopePending")}</p>
      <p>
        {t("projectEdited")} {edited}
      </p>
    </button>
  );
}

/** Home = "Tus proyectos": cards from the browser library plus "+ Nuevo proyecto". */
export function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { openProject } = useAnalysis();
  const { status: accessStatus } = useAccessSession();
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(() => readFlag(FIRST_VISIT_KEY));
  const exampleName = t("exampleProjectName");
  const teamMode = accessStatus === "authenticated";

  const refresh = useCallback(async () => {
    setItems(await listProjects());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await getLibraryStatus();
      if (accessStatus !== "authenticated") {
        await seedExampleOnce(exampleName, lang);
      }
      const rows = await listProjects();
      if (!cancelled) setItems(rows);
    })();
    return () => {
      cancelled = true;
    };
    // Refresh when team/local mode settles after whoami.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessStatus]);

  async function onOpen(id: string) {
    const project = await getProject(id);
    if (!project) return;
    openProject(project, preferredProjectView(project.config));
  }

  async function onNew() {
    const project = createEmptyProject({
      name: t("projectNewName"),
      config: { ...EMPTY_PROJECT_CONFIG, view: "datos", lang },
    });
    const saved = await upsertProject(project);
    await refresh();
    openProject(saved, "datos");
    requestOpenScope();
  }

  function onImport(file: File) {
    setImportError(null);
    void file.text().then(async (text) => {
      try {
        const imported = importAtlasProjectJson(text);
        const project = prepareImportedProject(
          imported,
          lang === "es" ? "importado" : "imported",
        );
        const saved = await upsertProject(project);
        await refresh();
        openProject(saved, preferredProjectView(saved.config));
      } catch (err) {
        setImportError(plainErrorMessage(err));
      }
    });
  }

  function dismissHint() {
    writeFlag(FIRST_VISIT_KEY);
    setHintDismissed(true);
    setTourOpen(false);
  }

  async function onUploadLocal() {
    setUploadMsg(null);
    try {
      const n = await uploadLocalProjectsToTeam();
      setUploadMsg(t("projectUploadLocalDone").replace("{n}", String(n)));
      await refresh();
    } catch (err) {
      setImportError(plainErrorMessage(err));
    }
  }

  return (
    <PageShell testId="home-view" titleKey="homeTitle" className="home">
      <p className="lead" data-testid="home-lead">
        {t("homeLead")}
      </p>
      {teamMode ? (
        <p className="muted small" data-testid="home-team-hint">
          {t("projectTeamHint")}
        </p>
      ) : null}

      {!hintDismissed ? (
        <p className="callout home-hint" role="note" data-testid="home-first-time">
          <span>{t("homeFirstTime")}</span>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="home-tour-open"
            onClick={() => setTourOpen(true)}
          >
            {t("homeTourOpen")}
          </button>
          <button
            type="button"
            className="btn ghost"
            data-testid="home-tour-dismiss"
            onClick={dismissHint}
          >
            {t("dismiss")}
          </button>
        </p>
      ) : null}
      {tourOpen ? <OnboardingTour onClose={dismissHint} /> : null}

      <div className="home-grid" data-testid="home-projects">
        {(items ?? []).map((item) => (
          <ProjectCard
            key={item.id}
            item={item}
            lang={lang}
            onOpen={(id) => void onOpen(id)}
          />
        ))}
        <button
          type="button"
          className="newp"
          data-testid="project-new"
          onClick={() => void onNew()}
        >
          {t("projectNew")}
        </button>
      </div>

      {importError ? (
        <p className="error" role="alert" data-testid="home-import-error">
          {importError}
        </p>
      ) : null}
      {uploadMsg ? (
        <p className="muted small" role="status" data-testid="home-upload-msg">
          {uploadMsg}
        </p>
      ) : null}
      <p className="muted small home-manage">
        <label className="file-import" data-testid="home-import-label">
          {t("importProject")}
          <input
            type="file"
            accept=".json,.atlas.json,application/json"
            data-testid="home-import"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
        </label>
        {teamMode ? (
          <>
            {" · "}
            <button
              type="button"
              className="linkish"
              data-testid="home-upload-local"
              onClick={() => void onUploadLocal()}
            >
              {t("projectUploadLocal")}
            </button>
          </>
        ) : null}
        {" · "}
        <PermalinkLink view="projects" data-testid="home-manage-link">
          {t("projectsManage")}
        </PermalinkLink>
      </p>
    </PageShell>
  );
}
