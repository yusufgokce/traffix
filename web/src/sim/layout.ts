import type { Aisle, Edge, Lot, Rect, Spot, Street, Vec } from "./types";

// A lot is described as straight, two-way aisles, each with rows of spots on
// one or both sides. Aisles run either across (y fixed) or down (x fixed);
// wherever two aisles meet they are joined. All units are metres, x to the
// right and y down.

export interface RowSpec {
  label: string;
  count: number;
  start: number; // where the first spot begins along the aisle
  first?: number; // number of the first spot, when a row is split in pieces
  accessible?: number[]; // spot numbers
}

type Rows = RowSpec | RowSpec[];

export type AisleSpec =
  | { y: number; x0: number; x1: number; above?: Rows; below?: Rows }
  | { x: number; y0: number; y1: number; left?: Rows; right?: Rows };

export interface LotSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  spot: { width: number; depth: number };
  aisleWidth: number;
  aisles: AisleSpec[];
  entrances: Vec[];
  exits: Vec[];
  building: Rect & { label: string };
  door: Vec;
  pricePerHour: number; // 0 = free lot
  timeLimitMin?: number; // posted maximum stay, if any
  stayMin?: number; // typical visit length, overrides the scenario default
  streets?: Street[]; // public roads around the lot, drawn for context
  areas?: { label: string; rect: Rect }[]; // zoom shortcuts in the console
}

interface Norm {
  axis: "h" | "v";
  c: number; // fixed coordinate
  s0: number;
  s1: number;
  neg: RowSpec[]; // above / left
  pos: RowSpec[]; // below / right
}

const list = (r?: Rows) => (r ? (Array.isArray(r) ? r : [r]) : []);

function normalize(a: AisleSpec): Norm {
  return "y" in a
    ? { axis: "h", c: a.y, s0: a.x0, s1: a.x1, neg: list(a.above), pos: list(a.below) }
    : { axis: "v", c: a.x, s0: a.y0, s1: a.y1, neg: list(a.left), pos: list(a.right) };
}

export function buildLot(spec: LotSpec): Lot {
  const nodes: Vec[] = [];
  const nodeAt = (x: number, y: number) => {
    for (let i = 0; i < nodes.length; i++) {
      if (Math.abs(nodes[i].x - x) < 0.5 && Math.abs(nodes[i].y - y) < 0.5) return i;
    }
    nodes.push({ x, y });
    return nodes.length - 1;
  };
  const edges = new Set<string>();
  const link: [number, number][] = [];
  const connect = (a: number, b: number) => {
    if (a === b) return;
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edges.has(k)) return;
    edges.add(k);
    link.push([a, b]);
  };

  const { width: sw, depth: sd } = spec.spot;
  const half = spec.aisleWidth / 2;
  const spots: Spot[] = [];
  const rowLabels: { label: string; x: number; y: number }[] = [];
  const all = spec.aisles.map(normalize);
  const at = (n: Norm, along: number) => (n.axis === "h" ? nodeAt(along, n.c) : nodeAt(n.c, along));
  const within = (v: number, lo: number, hi: number) => v >= lo - 0.5 && v <= hi + 0.5;

  const aisles: Aisle[] = all.map((a) => {
    const stops = new Set<number>([a.s0, a.s1]);
    for (const o of all) {
      if (o.axis !== a.axis && within(o.c, a.s0, a.s1) && within(a.c, o.s0, o.s1)) stops.add(o.c);
    }
    for (const row of [...a.neg, ...a.pos]) {
      for (let i = 0; i < row.count; i++) stops.add(round(row.start + i * sw + sw / 2));
    }
    const ids = [...stops].sort((p, q) => p - q).map((s) => at(a, s));
    const uniq = ids.filter((id, i) => ids.indexOf(id) === i);
    for (let i = 1; i < uniq.length; i++) connect(uniq[i - 1], uniq[i]);

    for (const [rows, side] of [[a.neg, -1], [a.pos, 1]] as const) {
      for (const row of rows) {
        const rowSpots: number[] = [];
        const first = row.first ?? 1;
        const depth0 = side < 0 ? a.c - half - sd : a.c + half;
        for (let i = 0; i < row.count; i++) {
          const along = row.start + i * sw;
          const rect: Rect =
            a.axis === "h" ? { x: along, y: depth0, w: sw, h: sd } : { x: depth0, y: along, w: sd, h: sw };
          const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
          const n = first + i;
          rowSpots.push(spots.length);
          spots.push({
            id: `${row.label}${String(n).padStart(2, "0")}`,
            row: row.label,
            index: n,
            rect,
            center,
            access: at(a, round(row.start + i * sw + sw / 2)),
            accessible: row.accessible?.includes(n) ?? false,
            doorDist: Math.hypot(center.x - spec.door.x, center.y - spec.door.y),
            neighbors: [],
          });
        }
        rowSpots.forEach((s, i) => {
          if (i > 0) spots[s].neighbors.push(rowSpots[i - 1]);
          if (i < rowSpots.length - 1) spots[s].neighbors.push(rowSpots[i + 1]);
        });
        if (first === 1 && rowSpots.length) {
          const r = spots[rowSpots[0]].rect;
          rowLabels.push(
            a.axis === "h"
              ? { label: row.label, x: r.x - 1.8, y: r.y + r.h / 2 }
              : { label: row.label, x: r.x + r.w / 2, y: r.y - 1.8 },
          );
        }
      }
    }
    return { axis: a.axis, c: a.c, s0: a.s0, s1: a.s1, nodes: uniq };
  });

  const attach = (p: Vec) => {
    const before = nodes.length;
    const id = nodeAt(p.x, p.y);
    if (id < before) return id;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (i === id) continue;
      const d = Math.hypot(nodes[i].x - p.x, nodes[i].y - p.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    connect(id, best);
    return id;
  };
  const entrances = spec.entrances.map(attach);
  const exits = spec.exits.map(attach);

  const adj: Edge[][] = nodes.map(() => []);
  for (const [a, b] of link) {
    const len = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
    adj[a].push({ to: b, len });
    adj[b].push({ to: a, len });
  }

  // Bounding box of everything drawn, with a small margin.
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const n of nodes) add(n.x, n.y);
  for (const s of spots) {
    add(s.rect.x, s.rect.y);
    add(s.rect.x + s.rect.w, s.rect.y + s.rect.h);
  }
  const b = spec.building;
  add(b.x, b.y);
  add(b.x + b.w, b.y + b.h);
  for (const st of spec.streets ?? []) {
    add(st.from.x, st.from.y);
    add(st.to.x, st.to.y);
  }
  const margin = 4;
  const x0 = Math.min(...xs) - margin;
  const y0 = Math.min(...ys) - margin;
  const bounds = { x: x0, y: y0, w: Math.max(...xs) + margin - x0, h: Math.max(...ys) + margin - y0 };

  return {
    id: spec.id,
    name: spec.name,
    width: spec.width,
    height: spec.height,
    aisleWidth: spec.aisleWidth,
    nodes,
    adj,
    aisles,
    spots,
    rowLabels,
    entrances,
    exits,
    building: spec.building,
    door: spec.door,
    pricePerHour: spec.pricePerHour,
    timeLimitMin: spec.timeLimitMin,
    stayMin: spec.stayMin,
    streets: spec.streets ?? [],
    areas: spec.areas ?? [],
    bounds,
  };
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}

// Shortest paths over the aisle graph. Results are cached per source node.
export class Router {
  private cache = new Map<number, { dist: Float64Array; prev: Int32Array }>();
  constructor(private lot: Lot) {}

  from(src: number) {
    let r = this.cache.get(src);
    if (r) return r;
    const n = this.lot.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[src] = 0;
    // Lots have at most a few thousand nodes, so a linear scan is fine.
    for (;;) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
      if (u < 0) break;
      done[u] = 1;
      for (const e of this.lot.adj[u]) {
        const d = best + e.len;
        if (d < dist[e.to]) {
          dist[e.to] = d;
          prev[e.to] = u;
        }
      }
    }
    r = { dist, prev };
    this.cache.set(src, r);
    return r;
  }

  dist(a: number, b: number) {
    return this.from(a).dist[b];
  }

  // Nodes after `a` up to and including `b`.
  path(a: number, b: number): number[] {
    if (a === b) return [];
    const { prev } = this.from(a);
    const out: number[] = [];
    for (let v = b; v !== a; v = prev[v]) {
      if (v < 0) return [];
      out.push(v);
    }
    return out.reverse();
  }
}
