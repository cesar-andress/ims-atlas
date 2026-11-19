/** Mirror of etl `imsatlas_etl.access.source_store` for UI badges (no invented rights). */

export type StoreKind = "abierta" | "cerrada";

function evidencePresent(rights: Record<string, unknown>): boolean {
  const evidence = rights.evidence;
  if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) {
    return false;
  }
  const ev = evidence as Record<string, unknown>;
  const checkedBy = ev.checked_by;
  const checkedOn = ev.checked_on;
  const termsUrl = ev.terms_url;
  const snapshot = ev.snapshot_sha256;
  return (
    typeof checkedBy === "string" &&
    checkedBy.trim().length > 0 &&
    typeof checkedOn === "string" &&
    checkedOn.trim().length > 0 &&
    typeof termsUrl === "string" &&
    termsUrl.trim().length > 0 &&
    typeof snapshot === "string" &&
    snapshot.trim().length > 0
  );
}

export function sourceStoreFromRights(
  rights: Record<string, unknown> | null | undefined,
): StoreKind {
  if (rights === null || rights === undefined) {
    return "cerrada";
  }
  if (!evidencePresent(rights)) {
    return "cerrada";
  }
  const raw = rights.redistribute_raw;
  const derived = rights.redistribute_derived;
  if (raw === "yes" || derived === "yes") {
    return "abierta";
  }
  return "cerrada";
}

export function resolveSourceStore(
  store: StoreKind | null | undefined,
  rights: Record<string, unknown> | null | undefined,
): StoreKind {
  if (store === "abierta" || store === "cerrada") {
    return store;
  }
  return sourceStoreFromRights(rights);
}
