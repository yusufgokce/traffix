import type { CarState, Instruction, SpotPref } from "@/sim/types";

// Messages between the simulator console and the driver phone app.

export type PhoneMsg =
  | { type: "join"; plate: string; permit: boolean; pref: SpotPref; spot?: string }
  | { type: "leave"; plate: string };

// Spot status codes sent to the phone: 0 open, 1 taken, 2 accessible open, 3 accessible taken.
export interface LotView {
  id: string;
  name: string;
  open: number;
  total: number;
  occupancy: number;
  congested: boolean;
  pricePerHour: number;
  timeLimitMin?: number;
  simTime: number;
  spots: { id: string; s: 0 | 1 | 2 | 3; d: number }[];
}

export interface PhoneCarView {
  plate: string;
  state: CarState | "gone";
  permit: boolean;
  target: string | null;
  spot: string | null;
  instruction: Instruction;
  reroute: { from: string; to: string; latency: number; t: number } | null;
  tIn: number;
  tParked: number;
  tOut: number;
}

export type SimMsg = { type: "state"; lot: LotView; cars: PhoneCarView[] };

export type Msg = PhoneMsg | SimMsg;
