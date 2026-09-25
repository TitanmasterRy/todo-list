// Fair randomness for the casino. Uses crypto.getRandomValues with rejection sampling (no modulo bias).
// Every game takes an Rng so tests can pass a seeded one.
export type Rng = () => number; // uniform in [0, 1)

export const cryptoRng: Rng = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const b = new Uint32Array(2);
    crypto.getRandomValues(b);
    // 53 random bits → [0, 1)
    return (b[0] * 2 ** 21 + (b[1] >>> 11)) / 2 ** 53;
  }
  return Math.random();
};

/** Integer in [0, n). */
export function randInt(n: number, rng: Rng = cryptoRng): number {
  return Math.floor(rng() * n);
}

export function shuffle<T>(arr: T[], rng: Rng = cryptoRng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1, rng);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick an index with the given weights. */
export function weighted(weights: number[], rng: Rng = cryptoRng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Deterministic RNG for tests (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round chip amounts down to whole chips. */
export function chips(n: number): number {
  return Math.max(0, Math.floor(n + 1e-9));
}
