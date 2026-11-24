# Traffix simulator

Split-screen parking simulator plus the driver phone app. The same cars arrive at the same times in two copies of a lot: one where drivers search on their own, one guided by Traffix. The console compares time to park, distance, idling, fuel cost, near misses and cars circling.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

- `/` is the simulator console. Pick a scenario (Quiet, Rush, Full) and press Play.
- `/phone` is the driver app. Click **Open driver app** in the console, enter a plate, and the car joins the Traffix lot.
- `/?play&speed=10&scenario=full` starts a run straight away.

```bash
npm test           # engine tests (determinism, no double parking, reroute < 5 s, ...)
npm run compare    # headless with/without comparison over several seeds
```

## Supabase (optional)

Without keys everything runs locally and the console and phone talk across tabs in the same browser.

1. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
2. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor.

With keys set, **Save run** stores comparison results, payments are stored in `parking_sessions`, and the phone app works from a real phone through Supabase Realtime.

## How it works

- `src/sim/layout.ts` turns a lot description into a drive graph (aisles, connectors, spots).
- `src/sim/scenario.ts` generates seeded arrivals. Demand is "pressure": 1.0 means arrivals just keep the lot full.
- `src/sim/engine.ts` moves the cars.
  - **Without Traffix:** drivers head for the aisle nearest the store, drive it end to end, and take the first open spot they pass.
  - **With Traffix:** drivers who follow guidance (90% by default) get the open spot nearest the door, reserved for them. If someone else takes it, they're rerouted within 5 seconds. When nothing is free they wait instead of circling.
- Guide lights show once the lot is 50% full (the congestion rule).

## Lots

- **Costco Kirkham Dr** (default, 755 spots): traced from Google Earth imagery using the scale bars. Lot 1 is west of the store, Lot 2 south of it, with driveways from Kirkham Dr, New Delhi Dr and Karachi Dr. Free parking, 45-minute typical visit.
- **Lot 01** (60 spots): the demo lot from the Figma designs, paid at $5/h.

Pick the lot from the dropdown in the console header, or use `?lot=demo-lot-01`.

## Adding a lot

Lots live in `src/sim/lots/`. Each one is a `LotSpec` in metres, with x to the right and y down:

- `aisles`: straight two-way aisles.
  - Across: `{ y, x0, x1, above, below }`. Down: `{ x, y0, y1, left, right }`.
  - Each side takes a row `{ label, start, count }` or a list of row pieces.
  - Aisles that cross or touch are joined automatically.
- `entrances` and `exits`: points just outside the lot. Each one is joined to the nearest aisle.
- `building`, `door` (the walking target), and `pricePerHour` (0 for a free lot).

Register the new lot in `src/sim/lots/index.ts`. `npm test` checks that every spot can be reached.
