/**
 * Seeded RNG for SMAA / bootstrap (SPEC §5).
 *
 * Algorithm: Mulberry32 (public-domain, 32-bit). Documented so the same seed
 * yields identical streams inside TypeScript. Monte Carlo agreement with
 * NumPy's PCG64 is statistical (see golden fixtures), not bit-identical.
 *
 * Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md (Mulberry32)
 */

export type Rng = {
  /** Uniform float in [0, 1). */
  random(): number;
  /** Uniform float in [lo, hi). */
  uniform(lo: number, hi: number): number;
  /** Inclusive integer in [lo, hi]. */
  integers(lo: number, hi: number): number;
  /** Copy of current state (for forks). */
  state(): number;
};

function imul(a: number, b: number): number {
  return Math.imul(a, b);
}

/** Create a Mulberry32 generator from a 32-bit seed. */
export function createRng(seed: number): Rng {
  let t = seed >>> 0;
  const nextU32 = (): number => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = imul(t ^ (t >>> 15), 1 | t);
    r = (r + imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return (r ^ (r >>> 14)) >>> 0;
  };
  return {
    random(): number {
      return nextU32() / 0x100000000;
    },
    uniform(lo: number, hi: number): number {
      return lo + (hi - lo) * this.random();
    },
    integers(lo: number, hi: number): number {
      // inclusive hi, matching numpy.random.Generator.integers(lo, hi+1) usage
      const span = hi - lo + 1;
      return lo + Math.floor(this.random() * span);
    },
    state(): number {
      return t >>> 0;
    },
  };
}

/**
 * Sample standard normal via Box–Muller (uses two uniforms).
 * Used only for gamma (Marsaglia–Tsang) in Dirichlet.
 */
export function randomNormal(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng.random();
  while (v === 0) v = rng.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Gamma(shape, 1) via Marsaglia–Tsang (shape >= 1) or boost (shape < 1).
 */
export function randomGamma(rng: Rng, shape: number): number {
  if (!(shape > 0) || !Number.isFinite(shape)) {
    throw new Error(`gamma shape must be positive; got ${shape}`);
  }
  if (shape < 1) {
    const g = randomGamma(rng, shape + 1);
    let u = rng.random();
    while (u === 0) u = rng.random();
    return g * u ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = randomNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Dirichlet(alpha) via independent gammas, then renormalise. */
export function randomDirichlet(rng: Rng, alpha: readonly number[]): number[] {
  const g = alpha.map((a) => randomGamma(rng, a));
  const s = g.reduce((acc, x) => acc + x, 0);
  return g.map((x) => x / s);
}
