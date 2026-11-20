import { describe, expect, it } from "vitest";
import type { ImsfeEocMatrixResult } from "@ims-atlas/core";
import { eocToStrategicMatrix } from "./eocToStrategic";

describe("eocToStrategicMatrix", () => {
  it("maps IMSFE→y and EOC→x with median cuts", () => {
    const eoc: ImsfeEocMatrixResult = {
      cutImsfe: 3.89,
      cutEoc: 2.04,
      points: [
        {
          iso3: "USA",
          imsfe: 7.1,
          eocNorm: 4.2,
          eocRaw: 0.5,
          quadrant: 1,
          rank: 1,
        },
      ],
    };
    const m = eocToStrategicMatrix(eoc);
    expect(m.cutAttractiveness).toBe(3.89);
    expect(m.cutFit).toBe(2.04);
    expect(m.points[0]).toMatchObject({
      iso3: "USA",
      attractiveness: 7.1,
      fit: 4.2,
      quadrant: 1,
      rank: 1,
    });
  });
});
