/** Plain-language labels for method ids (technical id stays in tooltip / title). */

type TFn = (key: string) => string;

export function methodPlainLabel(
  kind: "mcdm" | "norm" | "weight",
  id: string,
  t: TFn,
): string {
  if (kind === "mcdm") {
    if (id === "wsm") return t("methodLabelWsm");
    if (id === "topsis") return t("methodLabelTopsis");
    if (id === "vikor") return t("methodLabelVikor");
    if (id === "promethee_ii") return t("methodLabelPromethee");
  }
  if (kind === "norm") {
    if (id === "minmax") return t("normLabelMinmax");
    if (id === "ratio_legacy") return t("normLabelRatio");
    if (id === "zscore" || id === "robust_z") return t("normLabelZscore");
  }
  if (kind === "weight") {
    if (id === "equal") return t("weightLabelEqual");
    if (id === "expert_mean") return t("weightLabelExpert");
    if (id === "manual") return t("weightLabelManual");
    if (id === "entropy") return t("weightLabelEntropy");
    if (id === "critic") return t("weightLabelCritic");
  }
  return id;
}
