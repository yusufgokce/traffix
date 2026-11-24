import type { AisleSpec, LotSpec, RowSpec } from "../layout";

// Costco Wholesale, 65 Kirkham Dr, Markham. Traced from Google Earth imagery
// (2024-06-16) using the scale bars, so positions are within a few metres.
// North is up. x = 0 is New Delhi Dr, y = 0 is Kirkham Dr.
//
// Lot 1: west of the store. Rows run east-west.
// Lot 2: south of the store. Rows run north-south between two cross aisles.

const W = 2.7; // spot width

// Lot 1: five east-west aisles between the west lane (x 17.3) and the lane
// beside the store (x 80).
const lot1: AisleSpec[] = [
  { y: 20.8, x0: 17.3, x1: 80, above: { label: "A", start: 21, count: 21 }, below: { label: "B", start: 23.7, count: 18 } },
  { y: 40.4, x0: 17.3, x1: 80, above: { label: "C", start: 23.7, count: 18 }, below: { label: "D", start: 23.7, count: 18 } },
  { y: 60.7, x0: 17.3, x1: 80, above: { label: "E", start: 23.7, count: 18 }, below: { label: "F", start: 28, count: 14 } },
  { y: 82.2, x0: 17.3, x1: 80, above: { label: "G", start: 28, count: 14 }, below: { label: "H", start: 28, count: 15 } },
  {
    y: 102.5,
    x0: 17.3,
    x1: 80,
    above: { label: "J", start: 28, count: 15 },
    below: { label: "K", start: 21, count: 20, accessible: [16, 17, 18, 19] },
  },
  // West lane with a single row along the New Delhi Dr side.
  { x: 17.3, y0: 20.8, y1: 102.5, left: { label: "W", start: 22, count: 29 } },
  // Lane between Lot 1 and the store, from Kirkham Dr down to Lot 2.
  { x: 80, y0: 4, y1: 127, right: { label: "X", start: 18, count: 7 } },
];

// Lot 2: eleven north-south aisles. Each has a row of spots on both sides.
const lot2Aisles = [27.6, 48.5, 68.3, 93.0, 112.7, 132.5, 152.2, 173.9, 194.2, 213.4, 233.7];
const lot2Labels = ["AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AJ", "AK", "AL", "AM", "AN", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX"];
// Hatched accessible spots at the north end of the aisle closest to the door.
const accessibleRows = new Set(["AF", "AG"]);
const row = (label: string): RowSpec => ({
  label,
  start: 137,
  count: 21,
  accessible: accessibleRows.has(label) ? [1, 2, 3] : undefined,
});

const lot2: AisleSpec[] = [
  // North cross aisle, in from New Delhi Dr, with the row along the store front.
  { y: 127, x0: 4, x1: 233.7, above: { label: "Y", start: 142, count: 27 } },
  // South cross aisle with the row along Karachi Dr, broken by two islands.
  {
    y: 201,
    x0: 27.6,
    x1: 233.7,
    below: [
      { label: "Z", start: 28, count: 10 },
      { label: "Z", start: 87, count: 22, first: 11 },
      { label: "Z", start: 159, count: 27, first: 33 },
    ],
  },
  ...lot2Aisles.map((x, i) => ({
    x,
    y0: 127,
    y1: 201,
    left: row(lot2Labels[i * 2]),
    right: row(lot2Labels[i * 2 + 1]),
  })),
];

export const costcoKirkham: LotSpec = {
  id: "costco-kirkham",
  name: "Costco Kirkham Dr",
  width: 246,
  height: 222,
  spot: { width: W, depth: 5.5 },
  aisleWidth: 7,
  aisles: [...lot1, ...lot2],
  // Two-way driveways: Kirkham Dr (north), New Delhi Dr (west), Karachi Dr (south).
  entrances: [
    { x: 80, y: 0 },
    { x: 0, y: 127 },
    { x: 152.2, y: 214 },
  ],
  exits: [
    { x: 80, y: 0 },
    { x: 0, y: 127 },
    { x: 152.2, y: 214 },
  ],
  building: { x: 100, y: 8, w: 136, h: 108, label: "Costco Wholesale" },
  door: { x: 104, y: 117 }, // south-west corner, by the Vision Centre
  pricePerHour: 0,
  stayMin: 45,
  streets: [
    { name: "Kirkham Dr", from: { x: -10, y: -6 }, to: { x: 250, y: -6 }, width: 9 },
    { name: "New Delhi Dr", from: { x: -8, y: -10 }, to: { x: -8, y: 226 }, width: 9 },
    { name: "Karachi Dr", from: { x: -10, y: 221 }, to: { x: 250, y: 221 }, width: 9 },
  ],
  areas: [
    { label: "Lot 1", rect: { x: 2, y: 2, w: 100, h: 118 } },
    { label: "Lot 2", rect: { x: 10, y: 110, w: 240, h: 108 } },
  ],
};
