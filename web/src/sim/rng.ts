// Seeded PRNG (mulberry32) so every run with the same seed replays exactly.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = ReturnType<typeof rng>;

export function between(r: Rand, lo: number, hi: number) {
  return lo + (hi - lo) * r();
}

// Log-normal draw with the given mean and standard deviation.
export function lognormal(r: Rand, mean: number, sd: number) {
  const s2 = Math.log(1 + (sd * sd) / (mean * mean));
  const mu = Math.log(mean) - s2 / 2;
  const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return Math.exp(mu + Math.sqrt(s2) * z);
}

const LETTERS = "ABCDEFGHJKLMNPRSTVWXYZ";

export function plate(r: Rand) {
  let s = "";
  for (let i = 0; i < 4; i++) s += LETTERS[Math.floor(r() * LETTERS.length)];
  return `${s} ${100 + Math.floor(r() * 900)}`;
}
