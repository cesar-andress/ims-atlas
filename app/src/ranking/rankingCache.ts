/**
 * Deduplicate ranking work across Ranking / Matrix / Market map views.
 */
import {
  computeRanking,
  type RankingRequest,
  type RankingViewModel,
} from "./rankingEngine";

let cachedKey = "";
let cachedModel: RankingViewModel | null = null;
let inflight: Promise<RankingViewModel> | null = null;

function requestKey(req: RankingRequest): string {
  return JSON.stringify(req);
}

export function getCachedRanking(req: RankingRequest): Promise<RankingViewModel> {
  const key = requestKey(req);
  if (cachedModel && cachedKey === key) {
    return Promise.resolve(cachedModel);
  }
  if (inflight && cachedKey === key) {
    return inflight;
  }
  cachedKey = key;
  inflight = computeRanking(req)
    .then((model) => {
      cachedModel = model;
      inflight = null;
      return model;
    })
    .catch((err) => {
      inflight = null;
      if (cachedKey === key) {
        cachedModel = null;
        cachedKey = "";
      }
      throw err;
    });
  return inflight;
}

/** Test helper. */
export function clearRankingCache(): void {
  cachedKey = "";
  cachedModel = null;
  inflight = null;
}
