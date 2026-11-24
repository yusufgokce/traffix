// Runs every scenario headless with and without Traffix and prints the gap.
// Usage: npm run compare -- [seeds]
import { Sim, summarize } from "../src/sim/engine";
import { getLot, lotSpecs } from "../src/sim/lots";
import { makeScenario, presets } from "../src/sim/scenario";

const seeds = Number(process.argv[2] ?? 5);
const lotId = process.argv[3] ?? lotSpecs[0].id;
const lot = getLot(lotId);
const fmt = (v: number, d = 1) => v.toFixed(d).padStart(7);

console.log(`${lot.name} - ${lot.spots.length} spots, ${seeds} seeds per scenario\n`);
for (const preset of presets) {
  const acc = { baseline: [] as ReturnType<typeof summarize>[], traffix: [] as ReturnType<typeof summarize>[] };
  for (let seed = 1; seed <= seeds; seed++) {
    const sc = makeScenario(lot, preset, seed);
    for (const mode of ["baseline", "traffix"] as const) {
      const sim = new Sim(lot, sc, mode, { compliance: 0.9 });
      while (sim.t < sc.duration) sim.step(0.2);
      acc[mode].push(summarize(sim.metrics));
    }
  }
  const mean = (xs: ReturnType<typeof summarize>[], k: keyof ReturnType<typeof summarize>) =>
    xs.reduce((s, x) => s + (x[k] as number), 0) / xs.length;
  console.log(`== ${preset.name}`);
  console.log("metric              baseline  traffix");
  for (const [k, label, d] of [
    ["avgSearch", "avg search (s)", 1],
    ["p90Search", "p90 search (s)", 1],
    ["avgDistance", "distance/car (m)", 0],
    ["avgIdle", "idle/car (s)", 1],
    ["costPerCar", "fuel $/car", 3],
    ["nearMissesPer100", "near misses/100", 1],
    ["peakSearching", "peak circling", 0],
    ["gaveUp", "gave up", 1],
    ["turnedAway", "turned away", 1],
    ["reroutes", "reroutes", 1],
    ["maxReroute", "max reroute (s)", 2],
    ["parked", "parked", 0],
  ] as const) {
    console.log(`${label.padEnd(18)} ${fmt(mean(acc.baseline, k), d)}  ${fmt(mean(acc.traffix, k), d)}`);
  }
  console.log();
}
