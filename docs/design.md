# IMS Atlas — visual design notes (Phase W)

Decision-dashboard visuals follow published multi-criteria ranking and
uncertainty literature. Weight editing and “order them yourself” (Podium) live
only inside **Cambiar análisis → Pesos**; result screens stay read-only.

## References (verified)

1. **LineUp** — Gratzl, S., Lex, A., Gehlenborg, N., Pfister, H., & Streit, M.
   (2013). LineUp: Visual Analysis of Multi-Attribute Rankings.
   *IEEE Transactions on Visualization and Computer Graphics*, 19(12), 2277–2286.
   DOI: [10.1109/TVCG.2013.173](https://doi.org/10.1109/TVCG.2013.173).
   Used for: stacked criterion contribution bars in the ranking table.

2. **WeightLifter** — Pajer, S., Streit, M., Torsney-Weir, T., Spechtenhauser, F.,
   Möller, T., & Piringer, H. (2017). WeightLifter: Visual Weight Space Exploration
   for Multi-Criteria Decision Making.
   *IEEE Transactions on Visualization and Computer Graphics*, 23(1), 611–620.
   DOI: [10.1109/TVCG.2016.2598589](https://doi.org/10.1109/TVCG.2016.2598589).
   Used for: weight stability / one-at-a-time sensitivity intervals (aligns with
   Phase J 8d sensitivity).

3. **ValueCharts** — Carenini, G., & Loyd, J. (2004). ValueCharts: Analyzing Linear
   Models Expressing Preferences and Evaluations. In *Proceedings of the Working
   Conference on Advanced Visual Interfaces (AVI ’04)* (pp. 377–384). ACM.
   DOI: [10.1145/989863.989885](https://doi.org/10.1145/989863.989885).
   Used for: hierarchical / nested weight bars beside the ranking.

4. **Podium** — Wall, E., Das, S., Chawla, R., Kalidindi, B., Brown, E. T., &
   Endert, A. (2018). Podium: Ranking Data Using Mixed-Initiative Visual Analytics.
   *IEEE Transactions on Visualization and Computer Graphics*, 24(1), 288–297.
   DOI: [10.1109/TVCG.2017.2745078](https://doi.org/10.1109/TVCG.2017.2745078).
   Used for: “¿qué orden crees tú?” weight inference entry (builder only).

5. **Quantile dot plots** — Kay, M., Kola, T., Hullman, J. R., & Munson, S. A.
   (2016). When (ish) is My Bus? User-centered Visualizations of Uncertainty in
   Everyday, Mobile Predictive Systems. In *CHI ’16* (pp. 5092–5103). ACM.
   DOI: [10.1145/2858036.2858558](https://doi.org/10.1145/2858036.2858558).
   Used for: rank uncertainty as discrete dots instead of 10-colour stacked bars.

6. **Hypothetical Outcome Plots (HOPs)** — Hullman, J., Resnick, P., & Adar, E.
   (2015). Hypothetical Outcome Plots Outperform Error Bars and Violin Plots for
   Inferences about Reliability of Variable Ordering. *PLoS ONE*, 10(11), e0142444.
   DOI: [10.1371/journal.pone.0142444](https://doi.org/10.1371/journal.pone.0142444).
   Used for: optional animated ranking under sampled weights.

7. **Overview first, zoom and filter, then details on demand** — Shneiderman, B.
   (1996). The Eyes Have It: A Task by Data Type Taxonomy for Information
   Visualizations. In *Proceedings of the IEEE Symposium on Visual Languages*
   (pp. 336–343). IEEE.
   DOI: [10.1109/VL.1996.545307](https://doi.org/10.1109/VL.1996.545307).
   Used for: page structure (KPIs → main visual → country detail).

8. **Ten usability heuristics** — Nielsen, J. (1994). Enhancing the explanatory
   power of usability heuristics. In *CHI ’94* (pp. 152–158). ACM.
   DOI: [10.1145/191666.191729](https://doi.org/10.1145/191666.191729).
   Used for: review checklist (visibility of system status, match to the real
   world, user control, consistency, error prevention, recognition, flexibility,
   aesthetic and minimalist design, help users recover, help and documentation).

## Design tokens

Canonical CSS variables live in `app/src/design/tokens.css` (light/dark).
Tailwind maps those tokens in `app/tailwind.config.js` (utilities only; preflight
off). Criterion colours are Okabe–Ito and must match every chart and export.

## Static review page

`/design` shows labelled illustrative components and tokens before rollout review.
Values on that page are clearly marked as illustrative, not analysis results.
