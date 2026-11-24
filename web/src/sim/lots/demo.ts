import type { LotSpec } from "../layout";

// Lot 01 from the Figma console: rows A-F, ten spots each, store at the top.
// Placeholder until the Costco Kirkham layout is traced.
const row = (label: string, accessible?: number[]) => ({ label, count: 10, start: 8, accessible });

export const demoLot: LotSpec = {
  id: "demo-lot-01",
  name: "Lot 01 - University Building",
  width: 43,
  height: 82,
  spot: { width: 2.7, depth: 5.5 },
  aisleWidth: 7,
  aisles: [
    { y: 21, x0: 4, x1: 39, above: row("A", [1, 2, 9, 10]), below: row("B") },
    { y: 40, x0: 4, x1: 39, above: row("C"), below: row("D") },
    { y: 59, x0: 4, x1: 39, above: row("E"), below: row("F") },
    { y: 73, x0: 4, x1: 39 },
    { x: 4, y0: 21, y1: 73 },
    { x: 39, y0: 21, y1: 73 },
  ],
  entrances: [{ x: 4, y: 80 }],
  exits: [{ x: 39, y: 80 }],
  building: { x: 6, y: 1, w: 31, h: 7, label: "University Building" },
  door: { x: 21.5, y: 8 },
  pricePerHour: 5,
  timeLimitMin: 180,
};
