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
    if (id === "zscore") return t("normLabelZscore");
    if (id === "robust_z") return t("normLabelRobustZ");
    if (id === "rank") return t("normLabelRank");
    if (id === "log_minmax") return t("normLabelLogMinmax");
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

/** Method family names are proper names of published methods (same in ES and EN). */
export function methodFamilyLabel(family: string | undefined): string | null {
  if (family === "imsfe_2025") return "Baena & Cano (IMSFE)";
  if (family === "imsfem_2025_olive") return "Baena & Cano (IMSFEM)";
  if (family === "smi_2018") return "SMI 2018";
  if (family === "smi_2020") return "SMI 2020+";
  if (family === "panel_all") return "All panel variables";
  return null;
}
