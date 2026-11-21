/**
 * Incoterms® 2020 liquidation for one FEU case (Jose workbook + corrected mode).
 * Ported from atlas-redesign/preparar-exportacion.html — pure, deterministic.
 */

export type IncotermCostItem = {
  id: string;
  label: string;
  /** Euro amount per container (workbook defaults). */
  amountEur: number;
  /** Only used in corrected mode. */
  fixOnly?: boolean;
};

export type IncotermMode = "excel" | "corrected";

export type IncotermRuleKey =
  | "EXW"
  | "FCA"
  | "FAS"
  | "FOB"
  | "CFR/CPT"
  | "CIF/CIP/DAP"
  | "CFR"
  | "CPT"
  | "CIF"
  | "CIP"
  | "DAP"
  | "DPU"
  | "DDP";

export type IncotermRule = {
  key: IncotermRuleKey;
  /** Cost item ids the seller pays (on top of EXW). */
  includeIds: readonly string[];
  /** Whether import duty (and VAT in corrected mode) applies. */
  duty: boolean;
  plainEs: string;
};

export type LiquidationInput = {
  mode: IncotermMode;
  /** Units per container (Jose Excel: 7200). */
  units: number;
  /** Factory unit price EUR (Jose: 49). */
  exwUnitEur: number;
  /** Duty rate 0–1 (Jose: 0.10). */
  dutyRate: number;
  /** Import VAT 0–1 (corrected only; Jose Excel ignores VAT). */
  vatRate: number;
  /** Corrected duty base: US-style FOB vs CIF. */
  dutyBase: "cif" | "fob";
  /** Optional overrides for line amounts (€ / container). */
  amounts?: Partial<Record<string, number>>;
};

export type LiquidationRow = {
  key: IncotermRuleKey;
  totalEur: number;
  unitEur: number;
  plainEs: string;
  dutyEur: number;
  vatEur: number;
};

/** Default line items from Jose's workbook (€ per FEU). */
export const JOSE_COST_ITEMS: readonly IncotermCostItem[] = [
  { id: "cargue", label: "Cargue en fábrica", amountEur: 250 },
  { id: "segcarg", label: "Seguro del cargue", amountEur: 50 },
  { id: "tio", label: "Camión Tarragona–Barcelona", amountEur: 1500 },
  { id: "segtio", label: "Seguro del camión", amountEur: 150 },
  { id: "descpdo", label: "Descargue en puerto de origen", amountEur: 170 },
  { id: "agorig", label: "Agente de aduanas en origen", amountEur: 1100 },
  { id: "pdo", label: "Gastos en puerto de origen", amountEur: 750 },
  { id: "cargtin", label: "Cargue en el barco y su seguro", amountEur: 300 },
  { id: "tin", label: "Flete marítimo Barcelona–Miami", amountEur: 3500 },
  { id: "segtin", label: "Seguro del viaje en barco", amountEur: 290 },
  { id: "descpdd", label: "Descargue en Miami", amountEur: 200 },
  { id: "segdesc", label: "Seguro del descargue", amountEur: 160 },
  { id: "pdd", label: "Gastos en puerto de destino", amountEur: 550 },
  { id: "cargtid", label: "Cargue en el camión de destino", amountEur: 200 },
  { id: "segcargtid", label: "Seguro de ese cargue", amountEur: 50 },
  { id: "tid", label: "Camión puerto–cliente", amountEur: 900 },
  { id: "segtid", label: "Seguro del camión", amountEur: 100 },
  { id: "agdest", label: "Agente de aduanas en destino", amountEur: 800 },
  {
    id: "cipextra",
    label: "Seguro más amplio (CIP)",
    amountEur: 145,
    fixOnly: true,
  },
  {
    id: "descfinal",
    label: "Descargue en casa del cliente (DPU)",
    amountEur: 150,
    fixOnly: true,
  },
] as const;

const IDS = Object.fromEntries(JOSE_COST_ITEMS.map((x, i) => [x.id, i])) as Record<
  string,
  number
>;

function range(fromId: string, toId: string): string[] {
  const a = IDS[fromId];
  const b = IDS[toId];
  if (a === undefined || b === undefined) return [];
  return JOSE_COST_ITEMS.slice(a, b + 1).map((x) => x.id);
}

/** Jose Excel groupings (reproduces workbook SUM ranges). */
export const EXCEL_RULES: readonly IncotermRule[] = [
  {
    key: "EXW",
    includeIds: [],
    duty: false,
    plainEs: "Solo la mercancía en tu fábrica",
  },
  {
    key: "FCA",
    includeIds: ["cargue", "segcarg", "agorig"],
    duty: false,
    plainEs: "Cargue y despacho de exportación",
  },
  {
    key: "FAS",
    includeIds: range("cargue", "agorig"),
    duty: false,
    plainEs: "Camión y descargue junto al barco",
  },
  {
    key: "FOB",
    includeIds: range("cargue", "cargtin"),
    duty: false,
    plainEs: "A bordo del barco",
  },
  {
    key: "CFR/CPT",
    includeIds: range("cargue", "tin"),
    duty: false,
    plainEs: "Más flete marítimo",
  },
  {
    key: "CIF/CIP/DAP",
    includeIds: range("cargue", "segtin"),
    duty: false,
    plainEs: "Más seguro del barco",
  },
  {
    key: "DPU",
    includeIds: range("cargue", "segdesc"),
    duty: false,
    plainEs: "Más descargue en destino",
  },
  {
    key: "DDP",
    includeIds: range("cargue", "agdest"),
    duty: true,
    plainEs: "Todo hasta el cliente y aranceles",
  },
];

/** Corrected Incoterms® 2020 split (11 rules). */
export const CORRECTED_RULES: readonly IncotermRule[] = [
  {
    key: "EXW",
    includeIds: [],
    duty: false,
    plainEs: "Solo la mercancía en tu fábrica",
  },
  {
    key: "FCA",
    includeIds: ["cargue", "segcarg", "agorig"],
    duty: false,
    plainEs: "Cargada y despachada para exportar",
  },
  {
    key: "FAS",
    includeIds: range("cargue", "agorig"),
    duty: false,
    plainEs: "Junto al barco",
  },
  {
    key: "FOB",
    includeIds: range("cargue", "cargtin"),
    duty: false,
    plainEs: "A bordo del barco",
  },
  {
    key: "CFR",
    includeIds: range("cargue", "tin"),
    duty: false,
    plainEs: "Más flete (riesgo al subir al barco)",
  },
  {
    key: "CPT",
    includeIds: range("cargue", "tin"),
    duty: false,
    plainEs: "Como CFR, cualquier transporte",
  },
  {
    key: "CIF",
    includeIds: range("cargue", "segtin"),
    duty: false,
    plainEs: "Más seguro mínimo del viaje",
  },
  {
    key: "CIP",
    includeIds: [...range("cargue", "segtin"), "cipextra"],
    duty: false,
    plainEs: "Más seguro amplio (CIP)",
  },
  {
    key: "DAP",
    includeIds: range("cargue", "segtid"),
    duty: false,
    plainEs: "Hasta el cliente, sin descargar ni aduana",
  },
  {
    key: "DPU",
    includeIds: [...range("cargue", "segtid"), "descfinal"],
    duty: false,
    plainEs: "Hasta el cliente y descargada",
  },
  {
    key: "DDP",
    includeIds: [...range("cargue", "segtid"), "agdest"],
    duty: true,
    plainEs: "Todo pagado: entregada y con aranceles",
  },
];

export const JOSE_DEFAULT_INPUT: LiquidationInput = {
  mode: "excel",
  units: 7200,
  exwUnitEur: 49,
  dutyRate: 0.1,
  vatRate: 0,
  dutyBase: "cif",
};

function amountMap(
  overrides?: Partial<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of JOSE_COST_ITEMS) {
    out[item.id] = overrides?.[item.id] ?? item.amountEur;
  }
  return out;
}

function sumIds(ids: readonly string[], amounts: Record<string, number>): number {
  let s = 0;
  for (const id of ids) s += amounts[id] ?? 0;
  return s;
}

/** Compute liquidation rows for excel or corrected mode. */
export function liquidateIncoterms(input: LiquidationInput): LiquidationRow[] {
  const units = Math.max(1, Math.trunc(input.units));
  const amounts = amountMap(input.amounts);
  const rules = input.mode === "excel" ? EXCEL_RULES : CORRECTED_RULES;
  const exwTotal = input.exwUnitEur * units;

  const fobIds =
    rules.find((r) => r.key === "FOB")?.includeIds ?? range("cargue", "cargtin");
  const fobTotal = exwTotal + sumIds(fobIds, amounts);

  const cifRule =
    input.mode === "excel"
      ? rules.find((r) => r.key === "CIF/CIP/DAP")
      : rules.find((r) => r.key === "CIF");
  const cifTotal = exwTotal + sumIds(cifRule?.includeIds ?? [], amounts);

  return rules.map((rule) => {
    let total = exwTotal + sumIds(rule.includeIds, amounts);
    let dutyEur = 0;
    let vatEur = 0;
    if (rule.duty) {
      const base =
        input.mode === "excel"
          ? cifTotal
          : input.dutyBase === "fob"
            ? fobTotal
            : cifTotal;
      dutyEur = base * input.dutyRate;
      vatEur =
        input.mode === "excel" ? 0 : (base + dutyEur) * Math.max(0, input.vatRate);
      total += dutyEur + vatEur;
    }
    return {
      key: rule.key,
      totalEur: total,
      unitEur: total / units,
      plainEs: rule.plainEs,
      dutyEur,
      vatEur,
    };
  });
}

/** Jose Excel acceptance totals (exact within 0.5 €). */
export const JOSE_EXCEL_EXW_TOTAL = 352_800;
export const JOSE_EXCEL_DDP_TOTAL = 399_906;

/** Corrected US-style FOB duty base DDP total from the maqueta. */
export const JOSE_CORRECTED_DDP_TOTAL = 399_527;
