import { describe, expect, it } from "vitest";
import { Sim, summarize } from "./engine";
import { getLot } from "./lots";
import { makeScenario, presets } from "./scenario";

const lot = getLot("demo-lot-01");
const preset = (id: string) => presets.find((p) => p.id === id)!;

function run(mode: "baseline" | "traffix", id: string, seed: number, check?: (sim: Sim) => void) {
  const sc = makeScenario(lot, preset(id), seed);
  const sim = new Sim(lot, sc, mode, { compliance: 0.9 });
  while (sim.t < sc.duration) {
    sim.step(0.2);
    check?.(sim);
  }
  return sim;
}

describe("demo lot", () => {
  it("has 60 spots, 4 of them accessible", () => {
    expect(lot.spots).toHaveLength(60);
    expect(lot.spots.filter((s) => s.accessible).map((s) => s.id)).toEqual(["A01", "A02", "A09", "A10"]);
  });

  it("can reach every spot from the entrance", () => {
    for (const s of lot.spots) expect(Number.isFinite(new Sim(lot, makeScenario(lot, preset("quiet"), 1), "baseline").router.dist(lot.entrances[0], s.access))).toBe(true);
  });
});

describe("simulation", () => {
  it("replays exactly with the same seed", () => {
    const a = summarize(run("traffix", "rush", 7).metrics);
    const b = summarize(run("traffix", "rush", 7).metrics);
    expect(a).toEqual(b);
  });

  it("never puts two cars in one spot or holds a taken spot", () => {
    run("traffix", "full", 3, (sim) => {
      const ids = sim.cars.filter((c) => c.spot >= 0).map((c) => c.spot);
      expect(new Set(ids).size).toBe(ids.length);
      for (let i = 0; i < sim.hold.length; i++) if (sim.hold[i] >= 0) expect(sim.occ[i]).toBe(-1);
    });
  });

  it("keeps drivers without a permit out of accessible spots", () => {
    run("baseline", "full", 4, (sim) => {
      for (const c of sim.cars) if (c.spot >= 0 && lot.spots[c.spot].accessible && c.state === "park") expect(c.permit).toBe(true);
    });
  });

  it("reroutes within 5 seconds (US-4)", () => {
    for (let seed = 1; seed <= 5; seed++) {
      expect(run("traffix", "rush", seed).metrics.rerouteLatencyMax).toBeLessThan(5);
    }
  });

  it("cuts search time and distance in a rush", () => {
    let base = 0;
    let trx = 0;
    let baseDist = 0;
    let trxDist = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const b = summarize(run("baseline", "rush", seed).metrics);
      const t = summarize(run("traffix", "rush", seed).metrics);
      base += b.avgSearch;
      trx += t.avgSearch;
      baseDist += b.avgDistance;
      trxDist += t.avgDistance;
    }
    expect(trx).toBeLessThan(base);
    expect(trxDist).toBeLessThan(baseDist * 0.6);
  });

  it("gives a phone driver a spot and lets them leave", () => {
    const sc = makeScenario(lot, preset("quiet"), 2);
    const sim = new Sim(lot, sc, "traffix");
    sim.addPhoneCar("ABCD 123", false, "building");
    for (let i = 0; i < 1500 && sim.carByPlate("ABCD 123")?.state !== "parked"; i++) sim.step(0.2);
    const car = sim.carByPlate("ABCD 123")!;
    expect(car.state).toBe("parked");
    sim.requestLeave("ABCD 123");
    for (let i = 0; i < 1500 && sim.carByPlate("ABCD 123"); i++) sim.step(0.2);
    expect(sim.carByPlate("ABCD 123")).toBeUndefined();
  });

  it("sends a phone driver to the spot they picked if it is still free", () => {
    const sim = new Sim(lot, makeScenario(lot, preset("quiet"), 2), "traffix");
    const free = lot.spots.findIndex((s, i) => !s.accessible && sim.occ[i] < 0 && s.row === "F");
    sim.addPhoneCar("PICK 001", false, "building", lot.spots[free].id);
    for (let i = 0; i < 1500 && sim.carByPlate("PICK 001")?.state !== "parked"; i++) sim.step(0.2);
    expect(sim.carByPlate("PICK 001")?.spot).toBe(free);
  });
});

describe("costco kirkham lot", () => {
  const costco = getLot("costco-kirkham");

  it("has every spot reachable from every entrance", () => {
    const sim = new Sim(costco, makeScenario(costco, preset("quiet"), 1), "baseline");
    for (const e of costco.entrances) {
      for (const s of costco.spots) expect(Number.isFinite(sim.router.dist(e, s.access))).toBe(true);
    }
  });

  it("guides drivers to a spot faster than searching", () => {
    const sc = makeScenario(costco, preset("rush"), 1);
    const b = new Sim(costco, sc, "baseline");
    const t = new Sim(costco, sc, "traffix");
    while (b.t < 900) {
      b.step(0.2);
      t.step(0.2);
    }
    expect(summarize(t.metrics).avgSearch).toBeLessThan(summarize(b.metrics).avgSearch);
  });
});
