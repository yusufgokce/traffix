import { lognormal, plate, rng } from "./rng";
import type { Arrival, InitialCar, Lot, Scenario } from "./types";

// Demand is given as "pressure": 1.0 means cars arrive just fast enough to
// keep the lot full at the average dwell time. That way the same preset
// scales from the 60-spot demo lot to a lot with hundreds of spots.
export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  initialOccupancy: number;
  pressure: [number, number][]; // [minute, pressure], linear in between
  dwellMeanMin: number;
  dwellSdMin: number;
  permitShare: number;
}

export const presets: ScenarioPreset[] = [
  {
    id: "quiet",
    name: "Quiet",
    description: "Weekday morning. Plenty of open spots.",
    durationMin: 20,
    initialOccupancy: 0.25,
    pressure: [[0, 0.4], [20, 0.4]],
    dwellMeanMin: 20,
    dwellSdMin: 8,
    permitShare: 0.05,
  },
  {
    id: "rush",
    name: "Rush",
    description: "Saturday late morning. Lot goes from half full to packed.",
    durationMin: 30,
    initialOccupancy: 0.45,
    pressure: [[0, 0.6], [5, 1.3], [15, 1.3], [22, 0.8], [30, 0.7]],
    dwellMeanMin: 20,
    dwellSdMin: 8,
    permitShare: 0.05,
  },
  {
    id: "full",
    name: "Full",
    description: "Peak hour. Demand above capacity the whole time.",
    durationMin: 25,
    initialOccupancy: 0.85,
    pressure: [[0, 1.15], [25, 1.15]],
    dwellMeanMin: 25,
    dwellSdMin: 10,
    permitShare: 0.05,
  },
];

function pressureAt(p: [number, number][], min: number) {
  if (min <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [m1, v1] = p[i];
    const [m0, v0] = p[i - 1];
    if (min <= m1) return v0 + ((v1 - v0) * (min - m0)) / (m1 - m0);
  }
  return p[p.length - 1][1];
}

export function makeScenario(lot: Lot, preset: ScenarioPreset, seed: number): Scenario {
  const r = rng(seed);
  const cap = lot.spots.length;
  // A lot can set its own typical stay (a Costco trip runs longer than the default).
  const stretch = lot.stayMin ? lot.stayMin / preset.dwellMeanMin : 1;
  const dwellMean = preset.dwellMeanMin * stretch * 60;
  const dwellSd = preset.dwellSdMin * stretch * 60;

  // Cars already parked favour spots near the door, like a real lot.
  const maxDoor = Math.max(...lot.spots.map((s) => s.doorDist));
  const ranked = lot.spots
    .map((s, i) => ({ i, score: s.doorDist + r() * maxDoor * 0.8 + (s.accessible ? maxDoor : 0) }))
    .sort((a, b) => a.score - b.score);
  const initial: InitialCar[] = ranked.slice(0, Math.round(preset.initialOccupancy * cap)).map(({ i }) => ({
    spot: i,
    plate: plate(r),
    dwell: r() * dwellMean * 1.5,
  }));

  const duration = preset.durationMin * 60;
  const rate = (t: number) => (pressureAt(preset.pressure, t / 60) * cap) / dwellMean;
  const peak = Math.max(...preset.pressure.map(([, v]) => v)) * cap / dwellMean;
  const arrivals: Arrival[] = [];
  for (let t = 0; ; ) {
    t += -Math.log(1 - r()) / peak;
    if (t >= duration) break;
    if (r() > rate(t) / peak) continue;
    arrivals.push({
      t,
      plate: plate(r),
      permit: r() < preset.permitShare,
      u: r(),
      dwell: Math.max(120, lognormal(r, dwellMean, dwellSd)),
      entry: Math.floor(r() * lot.entrances.length),
    });
  }

  return { id: preset.id, name: preset.name, seed, duration, initial, arrivals };
}
