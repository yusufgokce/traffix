export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Spot {
  id: string; // "B04"
  row: string;
  index: number; // 1-based position in its row
  rect: Rect;
  center: Vec;
  access: number; // graph node a car stops at to pull in
  accessible: boolean;
  doorDist: number; // walking distance (m) from spot to the store door
  neighbors: number[]; // spot indices directly left/right in the same row
}

export interface Edge {
  to: number;
  len: number;
}

export interface Aisle {
  axis: "h" | "v"; // across (y fixed) or down (x fixed)
  c: number; // the fixed coordinate
  s0: number;
  s1: number;
  nodes: number[]; // in increasing order along the aisle
}

export interface Lot {
  id: string;
  name: string;
  width: number;
  height: number;
  aisleWidth: number;
  nodes: Vec[];
  adj: Edge[][];
  aisles: Aisle[];
  spots: Spot[];
  rowLabels: { label: string; x: number; y: number }[];
  entrances: number[];
  exits: number[];
  building: Rect & { label: string };
  door: Vec;
  pricePerHour: number;
  timeLimitMin?: number;
  stayMin?: number;
  streets: Street[];
  areas: { label: string; rect: Rect }[];
  bounds: Rect; // everything worth drawing
}

export interface Street {
  name: string;
  from: Vec;
  to: Vec;
  width: number;
}

export type Mode = "baseline" | "traffix";

export type CarState =
  | "queued" // waiting at the entrance for a spot to free up (Traffix only)
  | "search" // driving the aisles looking for a spot
  | "route" // driving a planned route to an assigned spot
  | "park" // pulling into a spot
  | "parked"
  | "unpark" // backing out
  | "exit" // driving to the exit
  | "done";

export type SpotPref = "building" | "space";

export interface Arrival {
  t: number; // seconds from scenario start
  plate: string;
  permit: boolean; // accessible parking permit
  u: number; // uniform draw; car follows guidance when u < compliance
  dwell: number; // seconds parked
  entry: number; // index into lot.entrances
}

export interface InitialCar {
  spot: number;
  plate: string;
  dwell: number; // seconds left before it leaves
}

export interface Scenario {
  id: string;
  name: string;
  seed: number;
  duration: number; // seconds
  initial: InitialCar[];
  arrivals: Arrival[];
}

export type Instruction =
  | { kind: "straight" | "left" | "right"; distance: number }
  | { kind: "arrive"; distance: number; side: "left" | "right" }
  | { kind: "wait"; reason: string }
  | { kind: "stop" };

export interface SimEvent {
  t: number;
  text: string;
  tone?: "info" | "warn" | "good";
}
