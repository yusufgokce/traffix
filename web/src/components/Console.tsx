"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openChannel } from "@/lib/channel";
import { drawLot, type Frame } from "@/lib/draw";
import { clock, money } from "@/lib/format";
import type { LotView, Msg, PhoneCarView } from "@/lib/protocol";
import { supabase } from "@/lib/supabase";
import { CONGESTED_AT, Sim, summarize, type Summary } from "@/sim/engine";
import { getLot, lotSpecs } from "@/sim/lots";
import { makeScenario, presets } from "@/sim/scenario";
import type { Lot, Rect, SimEvent } from "@/sim/types";

const STEP = 0.2; // simulated seconds per physics step
const SPEEDS = [1, 2, 5, 10, 20];

interface Snapshot {
  t: number;
  duration: number;
  base: Summary;
  trx: Summary;
  baseOpen: number;
  trxOpen: number;
  occupancy: number;
  events: SimEvent[];
}

export default function Console() {
  const [lotId, setLotId] = useState(lotSpecs[0].id);
  const lot = useMemo(() => getLot(lotId), [lotId]);
  const [presetId, setPresetId] = useState("rush");
  const [seed, setSeed] = useState(1);
  const [compliance, setCompliance] = useState(0.9);
  const [speed, setSpeed] = useState(5);
  const [running, setRunning] = useState(false);
  const [visits, setVisits] = useState(52);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const sims = useRef<{ base: Sim; trx: Sim } | null>(null);
  const baseCanvas = useRef<HTMLCanvasElement>(null);
  const trxCanvas = useRef<HTMLCanvasElement>(null);
  // Shared camera for both lots: null fits the whole site.
  const view = useRef<Rect | null>(null);
  const frames = useRef(new Map<HTMLCanvasElement, Frame>());
  const [area, setArea] = useState("All");
  const phones = useRef(new Map<string, PhoneCarView>());
  const live = useRef({ running, speed });
  live.current = { running, speed };

  const preset = presets.find((p) => p.id === presetId)!;
  const scenario = useMemo(() => makeScenario(lot, preset, seed), [lot, preset, seed]);

  const reset = useCallback(() => {
    sims.current = {
      base: new Sim(lot, scenario, "baseline", { compliance }),
      trx: new Sim(lot, scenario, "traffix", { compliance }),
    };
    phones.current.clear();
    setSaved(null);
    // compliance is read live below; resetting on it would restart the run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot, scenario]);

  useEffect(reset, [reset]);

  // ?play&speed=10&scenario=full starts a run straight away (handy for demos).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("scenario") && presets.some((p) => p.id === q.get("scenario"))) setPresetId(q.get("scenario")!);
    if (q.get("speed") && SPEEDS.includes(Number(q.get("speed")))) setSpeed(Number(q.get("speed")));
    if (q.get("lot") && lotSpecs.some((l) => l.id === q.get("lot"))) setLotId(q.get("lot")!);
    if (q.has("play")) setRunning(true);
  }, []);

  useEffect(() => {
    if (sims.current) sims.current.trx.opts.compliance = compliance;
  }, [compliance]);

  // Physics runs on a timer so it keeps going when this tab is in the
  // background (e.g. while the driver app is open in another tab).
  useEffect(() => {
    let last = performance.now();
    let debt = 0;
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1.5, (now - last) / 1000);
      last = now;
      const s = sims.current;
      if (!s || !live.current.running) return;
      debt += dt * live.current.speed;
      let n = 0;
      while (debt >= STEP && n++ < 600) {
        s.base.step(STEP);
        s.trx.step(STEP);
        debt -= STEP;
      }
      if (n >= 600) debt = 0;
    }, 16);
    return () => clearInterval(id);
  }, []);

  // Drawing.
  useEffect(() => {
    let raf = 0;
    const highlight = new Set<string>();
    const frame = () => {
      const s = sims.current;
      if (s) {
        highlight.clear();
        for (const p of phones.current.keys()) highlight.add(p);
        for (const [canvas, sim] of [
          [baseCanvas.current, s.base],
          [trxCanvas.current, s.trx],
        ] as const) {
          if (!canvas) continue;
          const f = drawLot(canvas, sim, { highlight, view: view.current });
          if (f) frames.current.set(canvas, f);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Scroll to zoom, drag to pan, double-click to fit. Both lots move together.
  useEffect(() => {
    const canvases = [baseCanvas.current, trxCanvas.current].filter(Boolean) as HTMLCanvasElement[];
    const visible = (c: HTMLCanvasElement) => {
      const f = frames.current.get(c);
      if (!f) return null;
      return { f, r: { x: -f.ox / f.k, y: -f.oy / f.k, w: c.clientWidth / f.k, h: c.clientHeight / f.k } };
    };
    let drag: { c: HTMLCanvasElement; x: number; y: number } | null = null;
    const onWheel = (e: WheelEvent) => {
      const c = e.currentTarget as HTMLCanvasElement;
      const v = visible(c);
      if (!v) return;
      e.preventDefault();
      const box = c.getBoundingClientRect();
      const wx = (e.clientX - box.left - v.f.ox) / v.f.k;
      const wy = (e.clientY - box.top - v.f.oy) / v.f.k;
      const b = sims.current?.base.lot.bounds;
      let z = Math.exp(e.deltaY * 0.0015);
      if (v.r.w * z < 25) z = 25 / v.r.w;
      if (b && v.r.w * z > b.w * 2) z = (b.w * 2) / v.r.w;
      view.current = { x: wx - (wx - v.r.x) * z, y: wy - (wy - v.r.y) * z, w: v.r.w * z, h: v.r.h * z };
      setArea("");
    };
    const onDown = (e: PointerEvent) => {
      drag = { c: e.currentTarget as HTMLCanvasElement, x: e.clientX, y: e.clientY };
      drag.c.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const v = visible(drag.c);
      if (!v) return;
      const dx = (e.clientX - drag.x) / v.f.k;
      const dy = (e.clientY - drag.y) / v.f.k;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (dx === 0 && dy === 0) return;
      view.current = { ...v.r, x: v.r.x - dx, y: v.r.y - dy };
      setArea("");
    };
    const onUp = () => (drag = null);
    const onDbl = () => {
      view.current = null;
      setArea("All");
    };
    for (const c of canvases) {
      c.addEventListener("wheel", onWheel, { passive: false });
      c.addEventListener("pointerdown", onDown);
      c.addEventListener("pointermove", onMove);
      c.addEventListener("pointerup", onUp);
      c.addEventListener("dblclick", onDbl);
    }
    return () => {
      for (const c of canvases) {
        c.removeEventListener("wheel", onWheel);
        c.removeEventListener("pointerdown", onDown);
        c.removeEventListener("pointermove", onMove);
        c.removeEventListener("pointerup", onUp);
        c.removeEventListener("dblclick", onDbl);
      }
    };
  }, []);

  // A new lot starts fully zoomed out.
  useEffect(() => {
    view.current = null;
    setArea("All");
  }, [lotId]);

  const areas = [{ label: "All", rect: null as Rect | null }, ...lot.areas];
  const zoomTo = (label: string) => {
    view.current = areas.find((a) => a.label === label)?.rect ?? null;
    setArea(label);
  };
  const camera = (
    <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between">
      <div className="pointer-events-auto flex gap-1">
        {areas.length > 1 &&
          areas.map((a) => (
            <button
              key={a.label}
              onClick={() => zoomTo(a.label)}
              className={`rounded border px-2 py-0.5 text-[10px] tracking-wider ${
                area === a.label ? "border-lime bg-lime-deep text-white" : "border-edge bg-ink/80 text-dim hover:text-fog"
              }`}
            >
              {a.label.toUpperCase()}
            </button>
          ))}
      </div>
      <span className="text-[9px] tracking-wider text-dim/70">SCROLL ZOOM · DRAG PAN · DOUBLE-CLICK FIT</span>
    </div>
  );

  // Driver app connection + 4 Hz stats.
  useEffect(() => {
    const ch = openChannel((msg: Msg) => {
      const s = sims.current;
      if (!s) return;
      if (msg.type === "join") {
        s.trx.addPhoneCar(msg.plate, msg.permit, msg.pref, msg.spot);
        phones.current.set(msg.plate, pendingView(msg.plate, msg.permit, s.trx.t));
        setRunning(true);
      } else if (msg.type === "leave") {
        s.trx.requestLeave(msg.plate);
      }
    });
    const id = setInterval(() => {
      const s = sims.current;
      if (!s) return;
      const views = [...phones.current.entries()].map(([plate, prev]) => {
        const v = carView(s.trx, plate, prev);
        phones.current.set(plate, v);
        return v;
      });
      ch.send({ type: "state", lot: lotView(s.trx), cars: views });
      setSnap({
        t: s.trx.t,
        duration: s.trx.scenario.duration,
        base: summarize(s.base.metrics),
        trx: summarize(s.trx.metrics),
        baseOpen: s.base.capacity - s.base.occupied,
        trxOpen: s.trx.capacity - s.trx.occupied,
        occupancy: s.trx.occupancy,
        events: s.trx.events.slice(0, 7),
      });
    }, 250);
    return () => {
      clearInterval(id);
      ch.close();
    };
  }, []);

  const save = async () => {
    const sb = supabase();
    const s = sims.current;
    if (!sb || !s) return;
    const { error } = await sb.from("sim_runs").insert({
      lot_id: lot.id,
      scenario: preset.id,
      seed,
      compliance,
      sim_seconds: Math.round(s.trx.t),
      baseline: summarize(s.base.metrics),
      traffix: summarize(s.trx.metrics),
    });
    setSaved(error ? `Save failed: ${error.message}` : "Run saved");
  };

  const openPhone = () => window.open("/phone", "traffix-phone", "width=410,height=880");

  const done = snap && snap.t >= snap.duration;
  const congested = (snap?.occupancy ?? 0) >= CONGESTED_AT;

  return (
    <div className="flex h-dvh min-h-[720px] flex-col bg-ink font-mono text-fog">
      <header className="flex h-[76px] shrink-0 items-center gap-6 border-b border-edge px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded bg-lime font-sans text-xl font-black text-ink">T</div>
          <div>
            <div className="font-sans text-xl font-extrabold tracking-wide text-white">TRAFFIX</div>
            <div className="text-[10px] tracking-[0.2em] text-dim">PARKING SIMULATOR / V0.1</div>
          </div>
        </div>
        <nav className="mx-auto flex gap-2">
          {presets.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              title={p.description}
              className={`rounded border px-3.5 py-1.5 text-xs ${
                p.id === presetId ? "border-lime bg-lime-deep text-white" : "border-edge text-fog hover:border-dim"
              }`}
            >
              <span className="mr-2 text-dim">{String(i + 1).padStart(2, "0")}</span>
              {p.name}
            </button>
          ))}
        </nav>
        <div className="text-right text-[10px] leading-4 tracking-[0.15em] text-dim">
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            aria-label="Parking lot"
            className="rounded border border-edge bg-panel-2 px-1.5 py-0.5 text-[10px] tracking-[0.15em] text-fog"
          >
            {lotSpecs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name.toUpperCase()} · {buildCount(l)} SPOTS
              </option>
            ))}
          </select>
          <div className={running ? "text-lime" : "text-amber"}>
            {done ? "SCENARIO COMPLETE" : running ? `RUNNING · ${speed}X` : "PAUSED"}
          </div>
        </div>
        <div className="w-[120px] text-right text-2xl tabular-nums text-white">{clock(snap?.t ?? 0)}</div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[1fr_1fr_360px] gap-4 p-4">
        <LotPanel
          title="Without Traffix"
          subtitle="Drivers search the aisles on their own"
          canvas={baseCanvas}
          overlay={camera}
          open={snap?.baseOpen}
          total={lot.spots.length}
          summary={snap?.base}
        />
        <LotPanel
          title="With Traffix"
          subtitle={congested ? "Over 50% full · guide lights lead each car" : "Under 50% full · drivers pick from open spots"}
          canvas={trxCanvas}
          overlay={camera}
          open={snap?.trxOpen}
          total={lot.spots.length}
          summary={snap?.trx}
          accent
        />

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <Savings snap={snap} lot={lot} scenarioDwell={scenario.arrivals.map((a) => a.dwell)} visits={visits} setVisits={setVisits} />

          <Card title="Simulation controls" tag={preset.name.toUpperCase()}>
            <p className="mb-3 font-sans text-xs text-dim">{preset.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRunning((r) => !r)}
                className="flex-1 rounded bg-lime py-2 font-sans text-sm font-bold text-ink hover:brightness-110"
              >
                {running ? "❚❚ Pause" : "▶ Play"}
              </button>
              {SPEEDS.map((v) => (
                <button
                  key={v}
                  onClick={() => setSpeed(v)}
                  className={`w-10 rounded border text-xs ${v === speed ? "border-lime bg-lime-deep text-white" : "border-edge"}`}
                >
                  {v}x
                </button>
              ))}
            </div>
            <label className="mt-4 block text-[11px] text-dim">
              Drivers following guidance <span className="float-right text-fog">{Math.round(compliance * 100)}%</span>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={compliance}
                onChange={(e) => setCompliance(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-dim">
              Traffic seed
              <input
                type="number"
                min={1}
                value={seed}
                onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded border border-edge bg-panel-2 px-2 py-1 text-fog"
              />
              <button onClick={() => setSeed(1 + Math.floor(Math.random() * 9999))} className="rounded border border-edge px-2 py-1 hover:border-dim">
                New traffic
              </button>
              <button onClick={reset} className="ml-auto rounded border border-edge px-2 py-1 hover:border-dim">
                ↺ Reset
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={openPhone} className="rounded border border-edge py-2 text-xs hover:border-lime">
                Open driver app ↗
              </button>
              <button
                onClick={save}
                disabled={!supabase()}
                title={supabase() ? "Save this run to Supabase" : "Add Supabase keys to .env.local to save runs"}
                className="rounded border border-edge py-2 text-xs enabled:hover:border-lime disabled:opacity-40"
              >
                Save run
              </button>
            </div>
            {saved && <p className="mt-2 text-[11px] text-dim">{saved}</p>}
          </Card>

          <Card title="Live event log" tag="TRAFFIX LOT">
            <ul className="space-y-1.5 text-[11px]">
              {(snap?.events ?? []).map((e, i) => (
                <li key={`${e.t}-${i}`} className="flex gap-3">
                  <span className="text-lime">{clock(e.t)}</span>
                  <span className={e.tone === "warn" ? "text-amber" : "text-fog"}>{e.text}</span>
                </li>
              ))}
              {!snap?.events.length && <li className="text-dim">Press Play to start traffic.</li>}
            </ul>
          </Card>

          <Legend />
        </aside>
      </main>
    </div>
  );
}

function buildCount(spec: (typeof lotSpecs)[number]) {
  return getLot(spec.id).spots.length;
}

function LotPanel(props: {
  title: string;
  subtitle: string;
  canvas: React.RefObject<HTMLCanvasElement | null>;
  open?: number;
  total: number;
  summary?: Summary;
  accent?: boolean;
  overlay?: React.ReactNode;
}) {
  const s = props.summary;
  return (
    <section className={`flex min-h-0 flex-col rounded-lg border bg-panel ${props.accent ? "border-lime/40" : "border-edge"}`}>
      <div className="flex items-start justify-between border-b border-edge px-4 py-3">
        <div>
          <h2 className={`font-sans text-base font-bold ${props.accent ? "text-lime" : "text-white"}`}>{props.title}</h2>
          <p className="font-sans text-xs text-dim">{props.subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-xl tabular-nums text-white">
            {props.open ?? "--"}
            <span className="text-sm text-dim"> / {props.total}</span>
          </div>
          <div className="text-[10px] tracking-widest text-dim">OPEN</div>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas ref={props.canvas} className="absolute inset-0 size-full cursor-grab touch-none active:cursor-grabbing" />
        {props.overlay}
      </div>
      <div className="grid grid-cols-4 border-t border-edge text-center">
        <Stat label="Avg search" value={s ? `${Math.round(s.avgSearch)} s` : "--"} />
        <Stat label="Circling now" value={s ? String(s.searchingNow) : "--"} />
        <Stat label="Parked" value={s ? String(s.parked) : "--"} />
        <Stat label="Gave up / away" value={s ? String(s.gaveUp + s.turnedAway) : "--"} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-edge px-2 py-2 last:border-r-0">
      <div className="text-base tabular-nums text-white">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-dim">{label}</div>
    </div>
  );
}

function Card({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-sans text-sm font-semibold text-white">{title}</h3>
        {tag && <span className="rounded bg-lime-deep px-1.5 py-0.5 text-[9px] tracking-widest text-lime">{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function Savings(props: {
  snap: Snapshot | null;
  lot: Lot;
  scenarioDwell: number[];
  visits: number;
  setVisits: (v: number) => void;
}) {
  const { snap, lot, visits } = props;
  const b = snap?.base;
  const t = snap?.trx;
  const pct = (x: number, y: number) => (x > 0 ? Math.round(((y - x) / x) * 100) : 0);
  const rows: [string, (s: Summary) => number, (v: number) => string][] = [
    ["Time to park", (s) => s.avgSearch, (v) => `${Math.round(v)} s`],
    ["Distance driven", (s) => s.avgDistance, (v) => `${Math.round(v)} m`],
    ["Idling", (s) => s.avgIdle, (v) => `${Math.round(v)} s`],
    ["Fuel cost", (s) => s.costPerCar, (v) => `${(v * 100).toFixed(1)}¢`],
    ["Near misses /100 cars", (s) => s.nearMissesPer100, (v) => v.toFixed(1)],
    ["Peak cars circling", (s) => s.peakSearching, (v) => String(Math.round(v))],
  ];

  // Billing by the minute vs a ticket rounded up to the hour.
  const overpay =
    lot.pricePerHour > 0 && props.scenarioDwell.length
      ? props.scenarioDwell.reduce((sum, d) => sum + (Math.ceil(d / 3600) - d / 3600) * lot.pricePerHour, 0) /
        props.scenarioDwell.length
      : 0;
  const minSaved = b && t ? Math.max(0, (b.avgSearch - t.avgSearch) / 60) : 0;
  const fuelSaved = b && t ? Math.max(0, b.costPerCar - t.costPerCar) : 0;
  const perVisit = fuelSaved + overpay;

  return (
    <Card title="With vs without" tag="PER DRIVER">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-dim">
            <th className="pb-1 text-left font-normal" />
            <th className="pb-1 text-right font-normal">Without</th>
            <th className="pb-1 text-right font-normal">With</th>
            <th className="pb-1 text-right font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get, fmt]) => {
            const x = b ? get(b) : 0;
            const y = t ? get(t) : 0;
            const c = pct(x, y);
            return (
              <tr key={label} className="border-t border-edge/60">
                <td className="py-1 font-sans text-fog">{label}</td>
                <td className="py-1 text-right tabular-nums">{b ? fmt(x) : "--"}</td>
                <td className="py-1 text-right tabular-nums text-white">{t ? fmt(y) : "--"}</td>
                <td className={`py-1 text-right tabular-nums ${c < 0 ? "text-lime" : c > 0 ? "text-alert" : "text-dim"}`}>
                  {b && t && x > 0 ? `${c > 0 ? "+" : ""}${c}%` : "--"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 rounded bg-lime-deep/60 p-3 font-sans">
        <div className="text-xs text-dim">Each visit saves</div>
        <div className="text-lg font-bold text-lime">
          {minSaved.toFixed(1)} min · {money(perVisit)}
        </div>
        <div className="mt-1 text-[11px] leading-4 text-fog">
          {money(fuelSaved)} fuel
          {overpay > 0 && <> + {money(overpay)} from paying by the minute instead of a rounded-up hourly ticket</>}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-dim">
          Over
          <input
            type="number"
            min={1}
            value={visits}
            onChange={(e) => props.setVisits(Math.max(1, Number(e.target.value) || 1))}
            className="w-14 rounded border border-edge bg-panel-2 px-1.5 py-0.5 text-fog"
          />
          visits a year:
          <span className="ml-auto font-semibold text-white">
            {((minSaved * visits) / 60).toFixed(1)} h · {money(perVisit * visits)}
          </span>
        </div>
      </div>
      <p className="mt-2 font-sans text-[10px] leading-4 text-dim">
        Same cars, same arrival times in both lots. Averages cover drivers who parked; drivers who gave up are counted separately.
      </p>
    </Card>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-[#c9d6bf]", "Open"],
    ["bg-[#1f2d1e] border border-[#2f4a2a]", "Open, guide mode"],
    ["bg-[#232d34] border border-edge", "Taken"],
    ["bg-[#b9d3e6]", "Accessible open"],
    ["bg-lime-deep border-2 border-lime", "Reserved target"],
    ["border-2 border-amber", "Circling > 60 s"],
  ];
  return (
    <Card title="State legend">
      <div className="grid grid-cols-2 gap-2 font-sans text-[11px]">
        {items.map(([cls, label]) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`inline-block h-3.5 w-5 rounded-sm ${cls}`} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="inline-flex w-5 justify-around">
            <i className="size-1 rounded-full bg-lime" />
            <i className="size-1 rounded-full bg-lime" />
          </span>
          Guide lights
        </div>
      </div>
    </Card>
  );
}

function lotView(sim: Sim): LotView {
  const lot = sim.lot;
  return {
    id: lot.id,
    name: lot.name,
    open: sim.capacity - sim.occupied,
    total: sim.capacity,
    occupancy: sim.occupancy,
    congested: sim.congested,
    pricePerHour: lot.pricePerHour,
    timeLimitMin: lot.timeLimitMin,
    simTime: sim.t,
    spots: lot.spots.map((s, i) => ({
      id: s.id,
      // Spots reserved for another driver show as taken.
      s: ((sim.occ[i] >= 0 || sim.hold[i] >= 0 ? 1 : 0) + (s.accessible ? 2 : 0)) as 0 | 1 | 2 | 3,
      d: Math.round(s.doorDist),
    })),
  };
}

function pendingView(plate: string, permit: boolean, t: number): PhoneCarView {
  return {
    plate,
    state: "queued",
    permit,
    target: null,
    spot: null,
    instruction: { kind: "wait", reason: "Waiting at the entrance camera" },
    reroute: null,
    tIn: t,
    tParked: -1,
    tOut: -1,
  };
}

function carView(sim: Sim, plate: string, prev: PhoneCarView): PhoneCarView {
  const car = sim.carByPlate(plate);
  if (!car) {
    // Still in the entry queue, or already gone through the exit.
    if (prev.state === "queued" && prev.tParked < 0 && sim.t - prev.tIn < 30) return prev;
    return prev.state === "gone" ? prev : { ...prev, state: "gone", tOut: prev.tOut > 0 ? prev.tOut : sim.t };
  }
  const spots = sim.lot.spots;
  return {
    plate,
    state: car.state,
    permit: car.permit,
    target: car.target >= 0 ? spots[car.target].id : null,
    spot: car.spot >= 0 ? spots[car.spot].id : prev.spot,
    instruction: sim.instruction(car),
    reroute: car.lastReroute,
    tIn: car.tIn,
    tParked: car.tParked,
    tOut: car.tOut,
  };
}
