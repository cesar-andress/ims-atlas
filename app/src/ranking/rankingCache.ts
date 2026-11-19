/**
 * Deduplicate ranking work across Ranking / Matrix / Market map views.
 */
import {
  computeRanking,
  type RankingRequest,
  type RankingViewModel,
} from "./rankingEngine";
import { rankingRequestKey } from "./rankingRequest";

let cachedKey = "";
let cachedModel: RankingViewModel | null = null;
let inflight: Promise<RankingViewModel> | null = null;
let inflightKey = "";

/** Synchronous cache hit (stale-while-revalidate / avoid loading flash). */
export function peekCachedRanking(req: RankingRequest): RankingViewModel | null {
  const key = rankingRequestKey(req);
  if (cachedModel && cachedKey === key) return cachedModel;
  return null;
}

export function getCachedRanking(req: RankingRequest): Promise<RankingViewModel> {
  const key = rankingRequestKey(req);
  if (cachedModel && cachedKey === key) {
    return Promise.resolve(cachedModel);
  }
  if (inflight && inflightKey === key) {
    return inflight;
  }
  inflightKey = key;
  cachedKey = key;
  inflight = computeRanking(req)
    .then((model) => {
      cachedModel = model;
      cachedKey = key;
      inflight = null;
      inflightKey = "";
      return model;
    })
    .catch((err) => {
      inflight = null;
      inflightKey = "";
      if (cachedKey === key) {
        cachedModel = null;
        cachedKey = "";
      }
      throw err;
    });
  return inflight;
}

/** Warm cache without awaiting (ConfigPanel / tab hover). */
export function prefetchRanking(req: RankingRequest): void {
  void getCachedRanking(req).catch(() => {
    /* pending release / network — ignore */
  });
}

/** Test helper. */
export function clearRankingCache(): void {
  cachedKey = "";
  cachedModel = null;
  inflight = null;
  inflightKey = "";
}
