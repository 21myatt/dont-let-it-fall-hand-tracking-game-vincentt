// Deterministic RNG (mulberry32), so rounds can be replayed for testing.

export type Rng = () => number;

export const makeRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** `?seed=N` fixes the round sequence; otherwise a fresh one each session. */
export const seedFromUrl = (search: string): number => {
  const s = Number(new URLSearchParams(search).get("seed"));
  return Number.isFinite(s) && s !== 0 ? s : Math.floor(Math.random() * 2 ** 31);
};

export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

export const shuffle = <T,>(rng: Rng, items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
