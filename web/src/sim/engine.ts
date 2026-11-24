import { Router } from "./layout";
import { between, rng, type Rand } from "./rng";
import type { Arrival, CarState, Instruction, Lot, Mode, Scenario, SimEvent, SpotPref, Vec } from "./types";

export const PHYS = {
  cruise: 4.2, // m/s (~15 km/h) when the driver knows where to go
  searchSpeed: 2.8, // m/s while looking at spots
  carLen: 4.6,
  minGap: 1.8,
  headway: 1.0, // seconds of gap kept to the car ahead
  parkTime: 7,
  unparkTime: 6,
  laneOffset: 1.6, // cars keep right of the aisle centre line
  giveUp: 600, // a searching driver gives up and leaves after 10 min
  queueLimit: 180, // a car held at a full entrance leaves after 3 min
  detect: [0.6, 2.4] as const, // seconds for sensors + reassignment to react
};

// Low-speed lot driving burns far more per km than highway driving.
export const FUEL = {
  litresPerKm: 0.15,
  idleLitresPerHour: 0.8,
  pricePerLitre: 1.45, // CAD, Ontario regular
  co2PerLitre: 2.31, // kg
};

export const CONGESTED_AT = 0.5; // lot counts as congested at 50% occupancy

export interface Car {
  id: number;
  plate: string;
  permit: boolean;
  guided: boolean; // follows Traffix guidance (app or guide lights)
  phone: boolean;
  pref: SpotPref;
  state: CarState;
  node: number;
  next: number;
  s: number;
  len: number;
  plan: number[];
  x: number;
  y: number;
  hx: number;
  hy: number;
  v: number;
  target: number; // spot index it is routed to, -1 if none
  spot: number; // spot it occupies, -1 if none
  tIn: number;
  tParked: number;
  tOut: number;
  timer: number;
  dwell: number;
  visited: Set<number>;
  dist: number;
  idle: number;
  laps: number;
  stopped: number; // seconds since last moving
  pendingReroute: number;
  lostAt: number;
  lost: number; // spot that was taken from it
  lastReroute: { from: string; to: string; latency: number; t: number } | null;
  gaveUp: boolean;
}

export interface Metrics {
  arrived: number;
  parked: number;
  searchTimeSum: number;
  searchTimeMax: number;
  searchTimes: number[];
  searchDistance: number;
  searchIdle: number;
  distance: number;
  idle: number;
  nearMisses: number;
  reroutes: number;
  rerouteLatencySum: number;
  rerouteLatencyMax: number;
  gaveUp: number;
  turnedAway: number;
  searchingNow: number;
  peakSearching: number;
  congestedTime: number;
}

const emptyMetrics = (): Metrics => ({
  arrived: 0,
  parked: 0,
  searchTimeSum: 0,
  searchTimeMax: 0,
  searchTimes: [],
  searchDistance: 0,
  searchIdle: 0,
  distance: 0,
  idle: 0,
  nearMisses: 0,
  reroutes: 0,
  rerouteLatencySum: 0,
  rerouteLatencyMax: 0,
  gaveUp: 0,
  turnedAway: 0,
  searchingNow: 0,
  peakSearching: 0,
  congestedTime: 0,
});

export interface SimOptions {
  compliance: number; // share of drivers who follow Traffix guidance
}

export class Sim {
  t = 0;
  cars: Car[] = [];
  occ: Int32Array; // car id in each spot, -1 = open
  hold: Int32Array; // car id the spot is reserved for, -1 = none
  blocked = new Map<number, { car: number; until: number }>();
  metrics = emptyMetrics();
  // Phone drivers are extra cars only the Traffix lot gets, so their numbers
  // are kept out of the with/without comparison.
  private phoneMetrics = emptyMetrics();
  events: SimEvent[] = [];
  router: Router;

  private r: Rand;
  private nextArrival = 0;
  private entryQueue: Arrival[] = [];
  private nextId = 1;
  private spotsAt: number[][];
  private nodeAisle: Int32Array;
  private aisleDoor: number[];
  private nearPairs = new Map<string, number>();
  private nearClock = 0;
  private wasCongested = false;

  constructor(
    public lot: Lot,
    public scenario: Scenario,
    public mode: Mode,
    public opts: SimOptions = { compliance: 0.9 },
  ) {
    this.r = rng(scenario.seed ^ 0x5eed);
    this.router = new Router(lot);
    this.occ = new Int32Array(lot.spots.length).fill(-1);
    this.hold = new Int32Array(lot.spots.length).fill(-1);
    this.spotsAt = lot.nodes.map(() => []);
    lot.spots.forEach((s, i) => this.spotsAt[s.access].push(i));
    this.nodeAisle = new Int32Array(lot.nodes.length).fill(-1);
    lot.aisles.forEach((a, i) => a.nodes.forEach((n) => (this.nodeAisle[n] = i)));
    // How far each aisle is from the store door: drivers try the nearest first.
    this.aisleDoor = lot.aisles.map((a) => {
      const along = Math.min(a.s1, Math.max(a.s0, a.axis === "h" ? lot.door.x : lot.door.y));
      return a.axis === "h" ? Math.hypot(along - lot.door.x, a.c - lot.door.y) : Math.hypot(a.c - lot.door.x, along - lot.door.y);
    });

    for (const init of scenario.initial) {
      const car = this.makeCar(init.plate, false, false, false);
      const spot = lot.spots[init.spot];
      car.state = "parked";
      car.spot = init.spot;
      car.node = spot.access;
      car.x = spot.center.x;
      car.y = spot.center.y;
      car.timer = init.dwell;
      this.occ[init.spot] = car.id;
      this.cars.push(car);
    }
  }

  get capacity() {
    return this.lot.spots.length;
  }

  get occupied() {
    let n = 0;
    for (let i = 0; i < this.occ.length; i++) if (this.occ[i] >= 0) n++;
    return n;
  }

  get occupancy() {
    return this.occupied / this.capacity;
  }

  get congested() {
    return this.occupancy >= CONGESTED_AT;
  }

  carByPlate(plate: string) {
    return this.cars.find((c) => c.plate === plate && c.state !== "done");
  }

  // A driver who joined from the phone app. Only meaningful in Traffix mode.
  addPhoneCar(plate: string, permit: boolean, pref: SpotPref, spot?: string) {
    const existing = this.carByPlate(plate);
    if (existing) return existing;
    if (this.entryQueue.some((a) => a.plate === plate)) return null;
    this.entryQueue.push({ t: this.t, plate, permit, u: 0, dwell: Infinity, entry: 0 });
    this.phonePrefs.set(plate, pref);
    if (spot) this.phoneSpots.set(plate, spot);
    return null;
  }

  requestLeave(plate: string) {
    const car = this.carByPlate(plate);
    if (!car) return;
    car.dwell = 0;
    if (car.state === "parked") car.timer = this.t;
  }

  private phonePrefs = new Map<string, SpotPref>();
  private phoneSpots = new Map<string, string>(); // spot the driver picked on the phone

  private makeCar(plate: string, permit: boolean, guided: boolean, phone: boolean, entry = 0): Car {
    const n = this.lot.entrances[entry] ?? this.lot.entrances[0];
    const p = this.lot.nodes[n];
    return {
      id: this.nextId++,
      plate,
      permit,
      guided,
      phone,
      pref: "building",
      state: "search",
      node: n,
      next: -1,
      s: 0,
      len: 0,
      plan: [],
      x: p.x,
      y: p.y,
      hx: 0,
      hy: -1,
      v: 0,
      target: -1,
      spot: -1,
      tIn: this.t,
      tParked: -1,
      tOut: -1,
      timer: 0,
      dwell: 0,
      visited: new Set(),
      dist: 0,
      idle: 0,
      laps: 0,
      stopped: 0,
      pendingReroute: -1,
      lostAt: -1,
      lost: -1,
      lastReroute: null,
      gaveUp: false,
    };
  }

  private mx(car: Car) {
    return car.phone ? this.phoneMetrics : this.metrics;
  }

  private log(text: string, tone: SimEvent["tone"] = "info") {
    this.events.unshift({ t: this.t, text, tone });
    if (this.events.length > 60) this.events.pop();
  }

  step(dt: number) {
    this.t += dt;
    const sc = this.scenario;
    while (this.nextArrival < sc.arrivals.length && sc.arrivals[this.nextArrival].t <= this.t) {
      this.entryQueue.push(sc.arrivals[this.nextArrival++]);
    }
    this.admit();

    for (const car of this.cars) this.update(car, dt);
    this.cars = this.cars.filter((c) => c.state !== "done");
    for (const [n, b] of this.blocked) if (b.until <= this.t) this.blocked.delete(n);

    this.nearClock += dt;
    if (this.nearClock >= 0.5) {
      this.nearClock = 0;
      this.checkNearMisses();
    }

    const m = this.metrics;
    let searching = 0;
    for (const c of this.cars) if (c.state === "search" || c.state === "route" || c.state === "queued") searching++;
    m.searchingNow = searching;
    m.peakSearching = Math.max(m.peakSearching, searching);
    const congested = this.congested;
    if (congested) m.congestedTime += dt;
    if (congested !== this.wasCongested && this.mode === "traffix") {
      this.log(congested ? "Lot over 50% - guide lights on" : "Lot under 50% - free choice", congested ? "warn" : "good");
    }
    this.wasCongested = congested;
  }

  // Let waiting arrivals onto their entrance lane once there is room.
  private admit() {
    const busy = new Set<number>();
    for (const c of this.cars) {
      if (c.next >= 0 && c.s < PHYS.carLen + PHYS.minGap && this.lot.entrances.includes(c.node)) busy.add(c.node);
    }
    const waiting: Arrival[] = [];
    for (const a of this.entryQueue) {
      const ent = this.lot.entrances[a.entry] ?? this.lot.entrances[0];
      if (busy.has(ent)) {
        waiting.push(a);
        continue;
      }
      busy.add(ent);
      this.enter(a);
    }
    this.entryQueue = waiting;
  }

  private enter(a: Arrival) {
    const phone = a.dwell === Infinity;
    const guided = this.mode === "traffix" && (phone || a.u < this.opts.compliance);
    const car = this.makeCar(a.plate, a.permit, guided, phone, a.entry);
    car.tIn = a.t;
    car.dwell = a.dwell;
    car.pref = this.phonePrefs.get(a.plate) ?? "building";
    this.cars.push(car);
    this.mx(car).arrived++;
    if (this.mode === "traffix" && this.available() === 0) {
      car.state = "queued";
      car.timer = this.t + PHYS.queueLimit;
      if (car.guided) this.log(`${car.plate} held at entrance - lot full`, "warn");
      return;
    }
    if (car.guided) {
      car.state = "route";
      this.assign(car, car.node);
      if (car.target >= 0) this.log(`${car.plate} entered - target ${this.lot.spots[car.target].id}`);
    }
  }

  private available() {
    let n = 0;
    for (let i = 0; i < this.occ.length; i++) if (this.occ[i] < 0 && this.hold[i] < 0) n++;
    return n;
  }

  private eligible(car: Car, i: number) {
    return car.permit || !this.lot.spots[i].accessible;
  }

  // Pick the best open, unreserved spot and route the car to it.
  private assign(car: Car, from: number) {
    const spots = this.lot.spots;
    let best = -1;
    let bestScore = Infinity;
    const score = (i: number) => {
      let s = spots[i].doorDist + 0.05 * this.router.dist(from, spots[i].access);
      if (car.permit && !spots[i].accessible) s += 1000;
      if (car.pref === "space" && spots[i].neighbors.some((n) => this.occ[n] >= 0)) s += 500;
      return s;
    };
    for (let i = 0; i < spots.length; i++) {
      if (this.occ[i] >= 0 || this.hold[i] >= 0 || !this.eligible(car, i)) continue;
      const s = score(i);
      if (s < bestScore) {
        bestScore = s;
        best = i;
      }
    }
    // Honour the spot the driver picked on the phone while it is still free.
    const picked = car.phone ? this.phoneSpots.get(car.plate) : undefined;
    if (picked !== undefined) {
      this.phoneSpots.delete(car.plate);
      const i = spots.findIndex((s) => s.id === picked);
      if (i >= 0 && this.occ[i] < 0 && this.hold[i] < 0 && this.eligible(car, i)) best = i;
    }
    if (car.target >= 0 && this.hold[car.target] === car.id) this.hold[car.target] = -1;
    car.target = best;
    if (best < 0) {
      // Nothing left to hand out: pull over and wait instead of circling.
      if (car.next >= 0) car.node = car.next;
      car.next = -1;
      car.s = 0;
      car.plan = [];
      car.v = 0;
      car.state = "queued";
      car.timer = this.t + PHYS.queueLimit;
      return;
    }
    this.hold[best] = car.id;
    car.plan = this.router.path(from, spots[best].access);
  }

  private update(car: Car, dt: number) {
    switch (car.state) {
      case "queued": {
        car.idle += dt;
        this.mx(car).idle += dt;
        this.mx(car).searchIdle += dt;
        if (this.available() > 0) {
          if (car.guided) {
            car.state = "route";
            this.assign(car, car.node);
          } else car.state = "search";
        } else if (this.t >= car.timer) {
          this.giveUp(car);
          if (this.lot.entrances.includes(car.node)) {
            car.state = "done";
            this.mx(car).turnedAway++;
          } else {
            car.state = "exit";
            this.mx(car).gaveUp++;
            car.plan = this.exitPath(car.node);
          }
        }
        return;
      }
      case "park": {
        const spot = this.lot.spots[car.spot];
        const k = Math.min(1, 1 - (car.timer - this.t) / PHYS.parkTime);
        const a = this.lot.nodes[spot.access];
        car.x = a.x + (spot.center.x - a.x) * k;
        car.y = a.y + (spot.center.y - a.y) * k;
        if (this.t >= car.timer) {
          car.state = "parked";
          car.timer = this.t + car.dwell;
        }
        return;
      }
      case "parked":
        if (this.t >= car.timer) {
          car.state = "unpark";
          car.timer = this.t + PHYS.unparkTime;
          this.blocked.set(this.lot.spots[car.spot].access, { car: car.id, until: car.timer });
        }
        return;
      case "unpark":
        if (this.t >= car.timer) {
          const spot = this.lot.spots[car.spot];
          this.occ[car.spot] = -1;
          car.spot = -1;
          car.node = spot.access;
          car.state = "exit";
          car.tOut = this.t;
          car.next = -1;
          car.plan = this.exitPath(car.node);
        }
        return;
      case "search":
      case "route":
      case "exit":
        this.drive(car, dt);
        return;
    }
  }

  private exitPath(from: number) {
    let best: number[] = [];
    let bd = Infinity;
    for (const e of this.lot.exits) {
      const d = this.router.dist(from, e);
      if (d < bd) {
        bd = d;
        best = this.router.path(from, e);
      }
    }
    return best;
  }

  private drive(car: Car, dt: number) {
    const m = this.mx(car);
    const looking = car.state === "search" || car.state === "route";

    if (car.pendingReroute >= 0 && this.t >= car.pendingReroute) {
      car.pendingReroute = -1;
      const from = car.next >= 0 ? car.next : car.node;
      const lostId = car.lost >= 0 ? this.lot.spots[car.lost].id : "?";
      this.assign(car, from);
      if (car.target >= 0) {
        const latency = this.t - car.lostAt;
        m.reroutes++;
        m.rerouteLatencySum += latency;
        m.rerouteLatencyMax = Math.max(m.rerouteLatencyMax, latency);
        const to = this.lot.spots[car.target].id;
        car.lastReroute = { from: lostId, to, latency, t: this.t };
        this.log(`${car.plate} rerouted ${lostId} -> ${to} (${latency.toFixed(1)} s)`, "good");
      }
    }

    if (car.state === "search" && this.t - car.tIn > PHYS.giveUp) {
      this.giveUp(car);
      car.state = "exit";
      m.gaveUp++;
      car.plan = this.exitPath(car.next >= 0 ? car.next : car.node);
    }

    if (car.next < 0) {
      this.decide(car);
      if (car.next < 0) {
        car.v = 0;
        this.countStill(car, dt, looking);
        return;
      }
    }

    const vmax = car.state === "search" ? PHYS.searchSpeed : PHYS.cruise;
    const gap = this.gapAhead(car);
    const v = Math.max(0, Math.min(vmax, gap / PHYS.headway));
    car.v = v;
    car.s += v * dt;
    car.dist += v * dt;
    m.distance += v * dt;
    if (looking) m.searchDistance += v * dt;
    if (v < 0.3) this.countStill(car, dt, looking);
    else car.stopped = 0;

    while (car.next >= 0 && car.s >= car.len) {
      car.s -= car.len;
      car.node = car.next;
      car.next = -1;
      this.onNode(car);
      if (car.state !== "search" && car.state !== "route" && car.state !== "exit") return;
      if (car.next < 0) this.decide(car);
      if (car.next < 0) {
        car.s = 0;
        break;
      }
    }
    this.place(car);
  }

  private countStill(car: Car, dt: number, looking: boolean) {
    car.stopped += dt;
    car.idle += dt;
    const m = this.mx(car);
    m.idle += dt;
    if (looking) m.searchIdle += dt;
  }

  private setEdge(car: Car, to: number) {
    const a = this.lot.nodes[car.node];
    const b = this.lot.nodes[to];
    car.next = to;
    car.len = Math.hypot(b.x - a.x, b.y - a.y);
    if (car.len > 0) {
      car.hx = (b.x - a.x) / car.len;
      car.hy = (b.y - a.y) / car.len;
    }
  }

  private place(car: Car) {
    const a = this.lot.nodes[car.node];
    if (car.next < 0) {
      car.x = a.x - car.hy * PHYS.laneOffset;
      car.y = a.y + car.hx * PHYS.laneOffset;
      return;
    }
    const k = car.len > 0 ? car.s / car.len : 0;
    const b = this.lot.nodes[car.next];
    car.x = a.x + (b.x - a.x) * k - car.hy * PHYS.laneOffset;
    car.y = a.y + (b.y - a.y) * k + car.hx * PHYS.laneOffset;
  }

  private gapAhead(car: Car) {
    // Last-resort deadlock breaker: a car stuck for 20 s squeezes past.
    if (car.stopped > 20) return Infinity;
    let gap = Infinity;
    const need = PHYS.carLen + PHYS.minGap;
    const rem = car.len - car.s;
    const after = car.plan[0] ?? -1;
    for (const o of this.cars) {
      if (o === car || o.next < 0) continue;
      if (o.node === car.node && o.next === car.next) {
        if (o.s > car.s || (o.s === car.s && o.id < car.id)) gap = Math.min(gap, o.s - car.s - need);
      } else if (o.node === car.next && o.next === after && rem < 20 && car.stopped < 8) {
        // After 8 s of waiting, stop yielding to the next segment. Without
        // this, U-turns at aisle ends can lock cars in a loop that never clears.
        gap = Math.min(gap, rem + o.s - need);
      }
    }
    const b = this.blocked.get(car.next);
    if (b && b.car !== car.id && b.until > this.t) gap = Math.min(gap, rem - 4);
    return gap;
  }

  private onNode(car: Car) {
    const spots = this.lot.spots;
    if (car.state === "search") {
      const ai = this.nodeAisle[car.node];
      if (ai >= 0) car.visited.add(ai);
      let best = -1;
      for (const i of this.spotsAt[car.node]) {
        if (this.occ[i] >= 0 || !this.eligible(car, i)) continue;
        if (best < 0 || spots[i].doorDist < spots[best].doorDist) best = i;
      }
      // Drivers with a permit look for an accessible spot first.
      if (best >= 0 && car.permit && !spots[best].accessible && car.laps === 0) {
        const anyAccessibleOpen = spots.some((s, i) => s.accessible && this.occ[i] < 0);
        if (anyAccessibleOpen) best = -1;
      }
      if (best >= 0) this.startPark(car, best);
    } else if (car.state === "route") {
      if (car.target >= 0 && car.node === spots[car.target].access) {
        if (this.occ[car.target] < 0) this.startPark(car, car.target);
        else if (car.pendingReroute < 0) this.loseTarget(car, car.target, 0);
      }
    } else if (car.state === "exit" && this.lot.exits.includes(car.node) && car.plan.length === 0) {
      car.state = "done";
    }
  }

  private startPark(car: Car, i: number) {
    const holder = this.hold[i];
    if (holder >= 0 && holder !== car.id) {
      const other = this.cars.find((c) => c.id === holder);
      if (other) this.loseTarget(other, i, between(this.r, PHYS.detect[0], PHYS.detect[1]));
    }
    this.hold[i] = -1;
    this.occ[i] = car.id;
    car.spot = i;
    car.target = -1;
    car.state = "park";
    car.v = 0;
    car.next = -1;
    car.plan = [];
    car.timer = this.t + PHYS.parkTime;
    car.tParked = this.t;
    this.blocked.set(this.lot.spots[i].access, { car: car.id, until: car.timer });
    const m = this.mx(car);
    const took = this.t - car.tIn;
    m.parked++;
    m.searchTimeSum += took;
    m.searchTimeMax = Math.max(m.searchTimeMax, took);
    m.searchTimes.push(took);
    if (car.guided) this.log(`${car.plate} parked ${this.lot.spots[i].id} (${Math.round(took)} s)`);
  }

  // A driver who leaves without parking still spent that time looking, so it
  // counts toward the search averages. Leaving that out would flatter a lot
  // where frustrated drivers give up.
  private giveUp(car: Car) {
    const m = this.mx(car);
    const took = this.t - car.tIn;
    car.gaveUp = true;
    m.searchTimeSum += took;
    m.searchTimeMax = Math.max(m.searchTimeMax, took);
    m.searchTimes.push(took);
  }

  private loseTarget(car: Car, spot: number, delay: number) {
    if (this.hold[spot] === car.id) this.hold[spot] = -1;
    car.lost = spot;
    car.lostAt = this.t;
    car.pendingReroute = this.t + delay;
    this.log(`${this.lot.spots[spot].id} taken - rerouting ${car.plate}`, "warn");
  }

  // Called when a car has nothing left in its plan.
  private decide(car: Car) {
    if (car.state === "route") {
      if (car.target < 0) {
        car.state = "search";
      } else if (car.node !== this.lot.spots[car.target].access) {
        car.plan = this.router.path(car.node, this.lot.spots[car.target].access);
      } else {
        return; // waiting at the target for a reroute
      }
    }
    if (car.state === "search" && car.plan.length === 0) car.plan = this.searchPlan(car);
    if (car.state === "exit" && car.plan.length === 0 && !this.lot.exits.includes(car.node)) car.plan = this.exitPath(car.node);
    const n = car.plan.shift();
    if (n !== undefined) this.setEdge(car, n);
    else if (car.state === "exit") car.state = "done";
  }

  // Unguided search: head for the aisle nearest the store, drive it end to
  // end, then try the next nearest aisle. Start over after a full lap.
  private searchPlan(car: Car): number[] {
    const lot = this.lot;
    const withSpots = lot.aisles
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.nodes.some((n) => this.spotsAt[n].length > 0));
    let open = withSpots.filter(({ i }) => !car.visited.has(i));
    if (open.length === 0) {
      car.visited.clear();
      car.laps++;
      open = withSpots;
    }
    // Most drivers try the aisle nearest the door first, but not all in the
    // same order: each pick gets some noise so the lot isn't one long convoy.
    const cur = this.nodeAisle[car.node];
    const score = new Map(open.map(({ i }) => [i, this.aisleDoor[i] + this.r() * 40 + (i === cur ? -1e6 : 0)]));
    open.sort((p, q) => score.get(p.i)! - score.get(q.i)!);
    const { a, i } = open[0];
    car.visited.add(i);
    const first = a.nodes[0];
    const last = a.nodes[a.nodes.length - 1];
    const here = a.nodes.indexOf(car.node);
    let order: number[];
    if (here >= 0) {
      // Already in this aisle: keep going the way the car is facing.
      const goingRight = a.axis === "h" ? car.hx >= 0 : car.hy >= 0;
      order = goingRight ? a.nodes.slice(here + 1) : a.nodes.slice(0, here).reverse();
      if (order.length === 0) order = goingRight ? a.nodes.slice(0, here).reverse() : a.nodes.slice(here + 1);
      return order;
    }
    const toFirst = this.router.dist(car.node, first);
    const toLast = this.router.dist(car.node, last);
    const start = toFirst <= toLast ? first : last;
    order = start === first ? a.nodes.slice(1) : a.nodes.slice(0, -1).reverse();
    return [...this.router.path(car.node, start), ...order];
  }

  private checkNearMisses() {
    const moving = this.cars.filter((c) => c.next >= 0 && c.v > 0.5);
    for (const [k, until] of this.nearPairs) if (until <= this.t) this.nearPairs.delete(k);
    for (let i = 0; i < moving.length; i++) {
      for (let j = i + 1; j < moving.length; j++) {
        const a = moving[i];
        const b = moving[j];
        if (Math.abs(a.x - b.x) > 3 || Math.abs(a.y - b.y) > 3) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > 2.6) continue;
        if (a.hx * b.hx + a.hy * b.hy > 0.5) continue; // same direction = following
        if (a.next === b.node || b.next === a.node || a.node === b.node) continue; // queued around a corner
        const k = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (this.nearPairs.has(k)) continue;
        this.nearPairs.set(k, this.t + 10);
        this.metrics.nearMisses++;
      }
    }
  }

  // Remaining route as points, for guide lights and the phone view.
  routePoints(car: Car): Vec[] {
    const pts: Vec[] = [{ x: car.x, y: car.y }];
    if (car.next >= 0) pts.push(this.lot.nodes[car.next]);
    for (const n of car.plan) pts.push(this.lot.nodes[n]);
    return pts;
  }

  instruction(car: Car): Instruction {
    if (car.state === "queued") return { kind: "wait", reason: "Lot full - hold at the entrance" };
    if (car.state === "park" || car.state === "parked" || car.state === "unpark") return { kind: "stop" };
    if (car.stopped > 2 && car.next >= 0) return { kind: "wait", reason: "Cars ahead" };
    if (car.pendingReroute >= 0) return { kind: "wait", reason: "Updating your route" };
    const pts = this.routePoints(car);
    let dist = 0;
    let hx = car.hx;
    let hy = car.hy;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const nx = dx / len;
      const ny = dy / len;
      const cross = hx * ny - hy * nx;
      const dot = hx * nx + hy * ny;
      if (i > 1 && dot < 0.85) return { kind: cross > 0 ? "right" : "left", distance: dist };
      dist += len;
      hx = nx;
      hy = ny;
    }
    if (car.state === "route" && car.target >= 0) {
      const end = pts[pts.length - 1];
      const c = this.lot.spots[car.target].center;
      const cross = hx * (c.y - end.y) - hy * (c.x - end.x);
      return { kind: "arrive", distance: dist, side: cross > 0 ? "right" : "left" };
    }
    return { kind: "straight", distance: dist };
  }
}

export function summarize(m: Metrics) {
  const n = Math.max(1, m.searchTimes.length); // parked + gave up + turned away
  const sorted = [...m.searchTimes].sort((a, b) => a - b);
  const p90 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] : 0;
  const searchFuel = (m.searchDistance / 1000) * FUEL.litresPerKm + (m.searchIdle / 3600) * FUEL.idleLitresPerHour;
  return {
    avgSearch: m.searchTimeSum / n,
    p90Search: p90,
    maxSearch: m.searchTimeMax,
    avgDistance: m.searchDistance / n,
    avgIdle: m.searchIdle / n,
    fuelPerCar: searchFuel / n,
    costPerCar: (searchFuel / n) * FUEL.pricePerLitre,
    co2PerCar: (searchFuel / n) * FUEL.co2PerLitre,
    totalFuel: searchFuel,
    totalCost: searchFuel * FUEL.pricePerLitre,
    nearMisses: m.nearMisses,
    nearMissesPer100: (m.nearMisses / Math.max(1, m.arrived)) * 100,
    reroutes: m.reroutes,
    avgReroute: m.reroutes ? m.rerouteLatencySum / m.reroutes : 0,
    maxReroute: m.rerouteLatencyMax,
    gaveUp: m.gaveUp,
    turnedAway: m.turnedAway,
    peakSearching: m.peakSearching,
    searchingNow: m.searchingNow,
    parked: m.parked,
    arrived: m.arrived,
  };
}

export type Summary = ReturnType<typeof summarize>;
