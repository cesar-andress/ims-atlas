import { describe, expect, it } from "vitest";
import { kMeans2d, silhouette2d } from "./cluster.js";

describe("silhouette2d", () => {
  it("is higher for well-separated blobs than for random labels", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0.1 },
      { x: 0.05, y: -0.05 },
      { x: 5, y: 5 },
      { x: 5.1, y: 4.9 },
      { x: 4.9, y: 5.1 },
    ];
    const good = kMeans2d(points, 2, { seed: 1 });
    const silGood = silhouette2d(points, good.labels);
    expect(silGood).not.toBeNull();
    expect(silGood!).toBeGreaterThan(0.4);

    const bad = [0, 1, 0, 1, 0, 1];
    const silBad = silhouette2d(points, bad);
    expect(silBad).not.toBeNull();
    expect(silGood!).toBeGreaterThan(silBad!);
  });
});
