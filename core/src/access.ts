/** ABIERTO / CERRADO store taint (SPEC §13). Mirrored in etl access.py. */

export type StoreKind = "abierta" | "cerrada";

const RANK: Record<StoreKind, number> = { abierta: 0, cerrada: 1 };

/** Most restrictive input wins: any cerrada → cerrada. */
export function taint(...stores: Array<StoreKind | null | undefined>): StoreKind {
  let rank = 0;
  for (const store of stores) {
    if (store == null) continue;
    rank = Math.max(rank, RANK[store]);
  }
  return rank >= 1 ? "cerrada" : "abierta";
}
