import { navEn } from "./nav";

export const en = {
  appName: "IMS Atlas",
  tagline:
    "Build, compare, stress-test and backtest international market selection indices.",
  home: "Home",
  language: "Language",
  theme: "Theme",
  themeLight: "Light",
  themeDark: "Dark",
  statusNote: "In development — first public version coming soon",
  dataRelease: "Data release",
  footerCredit:
    "Developed within the R&D&I project [project name/code] of AISERV SYSTEMS SLU (Madrid, Spain).",
  footerRepo: "GitHub repository",
  footerBacktest: "ims-backtest",
  mainNav: "Main",
  configPanel: "Analysis config",
  origin: "Origin",
  year: "Year",
  product: "Product (HS)",
  region: "Candidate region",
  minImports: "Min imports (USD)",
  variables: "Variables",
  weightScheme: "Weights",
  factorWeights: "Factor weights",
  presetExpert2025: "IMSFE expert 2025",
  weightsEqual: "Equal",
  weightsManual: "Manual (sliders)",
  missingThreshold: "Missing-data threshold",
  normalization: "Normalisation",
  method: "Method",
  saveProject: "Save",
  exportProject: "Export JSON",
  importProject: "Import JSON",
  examplePermalinks: "Example permalinks",
  catalogIntro: "Variables by factor with licence badges and coverage heatmaps.",
  permalinkState: "Permalink config",
  loading: "Loading…",
  navMore: "More",
  analysisViews: "Analysis views",
  analysisNeedConfig:
    "Set origin, product (HS) and year in the config panel, or load the demo preset.",
  homeStart: "Start in Builder",
  status: "Status",
  coverage: "Coverage",
  selectVariable: "Select a variable",
  stubSoon: "This view arrives in a later phase.",
  builderIntro:
    "Configure origin, product, year, candidates, variables and weights in the left panel.",
  builderHint:
    "Until redistributable release data ships, rankings use the COL HS64 2023 demo panel (imsfe golden).",
  presetColHs64: "Load COL · HS64 · 2023 · IMSFE",
  openRanking: "Open ranking →",
  hs4Manual: "type a 4–6 digit code in HS",
  rerankMs: "Re-rank time",
  rank: "Rank",
  score: "Score",
  flags: "Flags",
  imputed: "imputed",
  mapLicence:
    "Map boundaries: Natural Earth 110m (public domain), slimmed and served with this app.",
  matrixIntro:
    "IMSFE-style attractiveness × fit scatter. Bubble size tracks the index score; dashed lines are cut-offs.",
  matrixCutoff: "Cut-offs",
  cutoffMedian: "Median",
  cutoffFixed: "Fixed",
  attractiveness: "Attractiveness",
  fit: "Fit",
  quadrant: "Quadrant",
  mapIntro:
    "VOSviewer-like layout: SMACOF MDS on normalised criteria profiles, seeded k-means clusters, zoom/pan.",
  mapSeed: "Layout seed",
  mapColor: "Colour by",
  colorCluster: "Cluster",
  colorQuadrant: "Quadrant",
  uncertaintyIntro:
    "SMAA rank acceptability, P(top-k), central weights, and tornado sensitivity (±50% on each factor weight).",
  pTopKTable: "P(top-k)",
  centralWeights: "Central weights",
  tornadoTitle: "Tornado sensitivity",
  tornadoHint:
    "Mean absolute rank change when one factor weight is scaled by ±50% and renormalised.",
  backtestIntro:
    "Would it have worked? Walk-forward predictive agreement with trade flows (ims-backtest T4), not causal effect.",
  backtestDisclaimer:
    "Figures measure predictive agreement with subsequent trade flows under the paper protocol. They are not estimates of causal effect of using the index.",
  backtestTarget: "Target",
  backtestHorizon: "Horizon",
  ndcgByMethod: "NDCG@10 by method",
  pairedLift: "Paired lift vs baselines (95% CI)",
  variableValue: "Variable / factor value (T6 ablation)",
  variableValueHint:
    "Walk-forward ΔNDCG@10 when adding fit / competition blocks on top of a macro base (paper T6).",
  looRankSensitivity: "Leave-one-out rank sensitivity (demo panel)",
  looHint:
    "Spearman of ranks after dropping each variable on the current demo panel. Not a walk-forward backtest.",
  timeIntro:
    "Bump chart of destination ranks over years for the COL · HS64 expert WSM series (imsfe panel ranks).",
  citeIntro:
    "Permalink, citation formats, and exports for the current analysis. DOIs are placeholders until Zenodo deposits exist.",
  doiPending: "DOI placeholders",
  configHash: "Config hash",
  byodInCitation: "BYOD variables in this analysis",
  download: "Download",
  exports: "Exports",
  byodIntro:
    "Upload a CSV (iso3, year, value[, iso3_d]) as a new variable. Processed only in this browser.",
  byodLocalOnly:
    "BYOD data never leaves the browser. It is not uploaded and is excluded from any public data release.",
  byodLabel: "Label",
  byodDirection: "Direction",
  byodFactor: "Factor",
  byodLoaded: "Loaded BYOD variables",
  byodEmpty: "No BYOD variables yet.",
  byodRemove: "Remove",
  byodClear: "Clear all",
  docsIntro:
    "Methods, glossary, short tutorials, and FAQ on what the backtest does and does not show.",
  docsToc: "Documentation sections",
  skipToContent: "Skip to content",
  mobileReadOnly:
    "Mobile layout is read-only: open this page on a larger screen to edit the analysis config.",
  docs: {
    section: {
      methods: "Methods",
      glossary: "Glossary",
      tutorials: "Tutorials",
      faq: "FAQ and limitations",
    },
    methods: {
      p1: "IMS Atlas scores destinations with hierarchical multi-criteria methods on country–year indicators. Time-t features use only data with year ≤ t.",
      p2: "Weights may be equal, manual, expert (IMSFE 2025 means), entropy, or CRITIC. Aggregation includes WSM, TOPSIS, VIKOR, and PROMETHEE II.",
      normTitle: "Normalisation",
      normCost: "(cost criteria use 1 − x′ after benefit-style scaling).",
      rankNorm:
        "average ranks within the candidate set (higher rank number = better after direction flip).",
      aggTitle: "Aggregation",
      aggOthers:
        "TOPSIS, VIKOR, and PROMETHEE II are available in the builder; SMAA samples weights around the chosen centre for WSM.",
      missingTitle: "Missing data",
      missingBody:
        "The candidate set is fixed. Variables above the missingness threshold are dropped (visible warning). Remaining gaps use median imputation with per-cell flags. Scoring refuses fewer than 20 candidates.",
      smaaBody:
        "Dirichlet (or box) sampling of hierarchical weights yields rank acceptability, P(top-k), and central weights. Tornado plots rescale one factor weight by ±50% and report mean |Δrank|.",
    },
    glossary: {
      ims: "International market selection: ranking foreign destinations for export or expansion.",
      mcdm: "Multi-criteria decision making / analysis (WSM, TOPSIS, VIKOR, PROMETHEE, …).",
      ndcg: "Normalised discounted cumulative gain at cutoff k; used in walk-forward backtests against trade outcomes.",
      smaa: "Stochastic multicriteria acceptability analysis: uncertainty over weights.",
      byod: "Bring your own data: CSV uploaded and processed only in the browser.",
      hs: "Harmonised System product code (HS2/HS4/HS6 chapters).",
    },
    tutorial: {
      exporterTitle: "For an exporter",
      exporter1:
        "Load the COL · HS64 · 2023 preset (or set your origin, HS, and year).",
      exporter2: "Open Ranking and the strategic matrix; compare two destinations.",
      exporter3: "Use Cite & export for a permalink and CSV of the ranking.",
      researcherTitle: "For a researcher",
      researcher1: "Inspect Uncertainty (SMAA) with a fixed seed for reproducibility.",
      researcher2:
        "Open Backtest and read NDCG@10 and paired lifts vs baselines (T4 fixture).",
      researcher3: "Export the config JSON and the Python snippet for ims-backtest.",
      agencyTitle: "For an export agency",
      agency1: "Share a permalink so colleagues see the same analysis state.",
      agency2:
        "Document licences in the data catalog before redistributing any release files.",
      agency3: "Keep BYOD uploads local; do not ship non-redistributable series.",
    },
    faq: {
      q1: "Does a good backtest score mean the index causes better exports?",
      a1: "No. The backtest measures predictive agreement with subsequent trade flows under a fixed protocol. It is not an estimate of causal effect of using the index.",
      q2: "What did the companion research paper find?",
      a2: "On the published T4 protocol, expert WSM NDCG@10 (intensive, k=1) is about 0.74 and does not clearly dominate simple baselines such as import volume or gravity PPML within bootstrap CIs. Treat IMS ranks as decision support, not proven predictors.",
      q3: "Why are some variables missing from the public release?",
      a3: "Only variables with redistributable licence and verified status may ship. Others are BYOD or local-only.",
      q4: "Why can Time explorer ranks differ from the Ranking view?",
      a4: "The demo Ranking panel uses the phase-8 golden export; Time uses a multi-year imsfe panel rank series. Both are labelled with provenance; they are not silently spliced.",
    },
  },
  nav: navEn,
} as const;
