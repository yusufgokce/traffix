"use client";

import { useEffect, useRef, useState } from "react";
import { openChannel } from "@/lib/channel";
import { clock, duration, money, parkingCost, stopwatch } from "@/lib/format";
import type { LotView, Msg, PhoneCarView } from "@/lib/protocol";
import { supabase } from "@/lib/supabase";
import type { Instruction, SpotPref } from "@/sim/types";
import { AppHeader, Arrow, Card, Plate, Primary, StopSign, TargetCard, Toggle } from "./ui";

type Screen = "plate" | "confirm" | "choose" | "live" | "pay" | "method" | "receipt";
type Method = "card" | "wallet" | "plate" | "permit";

const PROVINCES = ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Nova Scotia", "New York", "Michigan"];
const DISCOUNT = 2;
const PLATE_OK = /^[A-Z0-9]{2,4} ?[A-Z0-9]{2,4}$/;

export default function PhoneApp() {
  const [screen, setScreen] = useState<Screen>("plate");
  const [plate, setPlate] = useState("");
  const [province, setProvince] = useState("Ontario");
  const [permit, setPermit] = useState(false);
  const [plateError, setPlateError] = useState(false);
  const [pref, setPref] = useState<SpotPref>("building");
  const [lot, setLot] = useState<LotView | null>(null);
  const [car, setCar] = useState<PhoneCarView | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [voice, setVoice] = useState(true);
  const [discount, setDiscount] = useState(false);
  const [method, setMethod] = useState<Method>("plate");
  const [leaving, setLeaving] = useState(false);
  const [now, setNow] = useState(0);
  const channel = useRef<ReturnType<typeof openChannel> | null>(null);
  const plateRef = useRef("");
  plateRef.current = plate.trim();

  useEffect(() => {
    const ch = openChannel((msg: Msg) => {
      if (msg.type !== "state") return;
      setLot(msg.lot);
      setLastSeen(Date.now());
      const mine = msg.cars.find((c) => c.plate === plateRef.current);
      if (mine) setCar(mine);
    });
    channel.current = ch;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      ch.close();
      clearInterval(id);
    };
  }, []);

  // Once the car has driven out, move on to payment.
  useEffect(() => {
    if (screen === "live" && car?.state === "gone" && leaving) setScreen("pay");
  }, [screen, car?.state, leaving]);

  const connected = now === 0 || now - lastSeen < 3000;
  const join = (p: SpotPref, spot?: string) => {
    setPref(p);
    setLeaving(false);
    setCar(null);
    channel.current?.send({ type: "join", plate: plate.trim(), permit, pref: p, spot });
    setScreen("live");
  };
  const leave = () => {
    setLeaving(true);
    channel.current?.send({ type: "leave", plate: plate.trim() });
  };

  const header: Record<Screen, string> = {
    plate: "Welcome",
    confirm: "Arrival",
    choose: lot?.name ?? "Choose a spot",
    live: car?.state === "parked" || car?.state === "park" ? lot?.name ?? "" : leaving ? "Exit route" : "Guide lights",
    pay: "Payment",
    method: "Method details",
    receipt: "Receipt",
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-app font-sans text-white sm:my-6 sm:min-h-[844px] sm:rounded-[36px] sm:border sm:border-white/10 sm:shadow-2xl">
      <AppHeader right={header[screen]} />
      {!connected && (
        <div className="bg-coral/20 px-5 py-2 text-sm text-coral">
          Simulator not running. Open the console in another tab and press Play.
        </div>
      )}
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-5">
        {screen === "plate" && (
          <PlateEntry
            plate={plate}
            setPlate={(v) => {
              setPlate(v);
              setPlateError(false);
            }}
            province={province}
            setProvince={setProvince}
            permit={permit}
            setPermit={setPermit}
            error={plateError}
            onContinue={() => {
              if (!PLATE_OK.test(plate.trim())) return setPlateError(true);
              setScreen("confirm");
            }}
          />
        )}
        {screen === "confirm" && (
          <Confirm
            plate={plate}
            province={province}
            permit={permit}
            lot={lot}
            onChoose={() => setScreen("choose")}
            onGuide={() => join("building")}
            onBack={() => setScreen("plate")}
          />
        )}
        {screen === "choose" && <Choose lot={lot} permit={permit} pref={pref} setPref={setPref} onGo={join} />}
        {screen === "live" && (
          <Live car={car} lot={lot} voice={voice} setVoice={setVoice} leaving={leaving} onLeave={leave} discount={discount} setDiscount={setDiscount} onRestart={() => setScreen("plate")} />
        )}
        {screen === "pay" && car && lot && (
          <PaySummary car={car} lot={lot} discount={discount} setDiscount={setDiscount} method={method} setMethod={setMethod} onPay={() => setScreen("method")} onDone={() => {
              setCar(null);
              setLeaving(false);
              setScreen("plate");
            }} />
        )}
        {screen === "method" && car && lot && (
          <MethodDetails
            method={method}
            plate={plate}
            discount={discount}
            onConfirm={async () => {
              await recordSession(car, lot, total(car, lot, discount));
              setScreen("receipt");
            }}
          />
        )}
        {screen === "receipt" && car && lot && (
          <Receipt
            car={car}
            lot={lot}
            discount={discount}
            onDone={() => {
              setCar(null);
              setLeaving(false);
              setScreen("plate");
            }}
          />
        )}
      </main>
    </div>
  );
}

function PlateEntry(p: {
  plate: string;
  setPlate: (v: string) => void;
  province: string;
  setProvince: (v: string) => void;
  permit: boolean;
  setPermit: (v: boolean) => void;
  error: boolean;
  onContinue: () => void;
}) {
  return (
    <>
      <div>
        <h1 className="text-[32px] font-extrabold leading-tight">Enter your licence plate</h1>
        <p className="mt-2 text-lg leading-snug text-soft">Lot cameras use your plate to track your car and guide you to a spot.</p>
      </div>
      <Plate value={p.plate} province={p.province} onChange={p.setPlate} error={p.error} />
      {p.error && <p className="-mt-2 text-coral">Check the plate. Use 2 to 8 letters and numbers, like ABCD 123.</p>}
      <label className="relative block rounded-2xl bg-card px-4 py-3">
        <span className="text-soft">Province / state</span>
        <select
          value={p.province}
          onChange={(e) => p.setProvince(e.target.value)}
          className="block w-full appearance-none bg-transparent text-lg font-semibold text-white outline-none"
        >
          {PROVINCES.map((v) => (
            <option key={v} className="bg-card">
              {v}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl">⌄</span>
      </label>
      <div className="flex items-center gap-3 text-lg font-semibold">
        I have an accessible parking permit
        <Toggle value={p.permit} onChange={p.setPermit} />
      </div>
      {p.permit && (
        <p className="-mt-2 rounded-xl bg-sky/10 px-4 py-3 text-sky">We&apos;ll guide you to the nearest accessible spot first.</p>
      )}
      <div className="mt-auto space-y-4">
        <Primary onClick={p.onContinue} disabled={!p.plate.trim()}>
          Continue
        </Primary>
        <p className="flex gap-2 text-soft">
          <span aria-hidden>🛡</span> Your plate is only used while you&apos;re in the lot.
        </p>
      </div>
    </>
  );
}

function lotMood(lot: LotView | null) {
  if (!lot) return { label: "Connecting…", tone: "text-soft" };
  const pct = Math.round(lot.occupancy * 100);
  if (lot.open === 0) return { label: `Lot full - ${pct}% occupied`, tone: "text-coral" };
  if (lot.congested) return { label: `Busy lot - ${pct}% occupied`, tone: "text-sun" };
  return { label: `Quiet lot - ${pct}% occupied`, tone: "text-mint" };
}

function Confirm(p: {
  plate: string;
  province: string;
  permit: boolean;
  lot: LotView | null;
  onChoose: () => void;
  onGuide: () => void;
  onBack: () => void;
}) {
  const lot = p.lot;
  const mood = lotMood(lot);
  const full = lot?.open === 0;
  const accessibleOpen = lot?.spots.filter((s) => s.s === 2).length ?? 0;
  return (
    <>
      <Plate value={p.plate} province={p.province} />
      <h1 className="text-[32px] font-extrabold leading-tight">
        Camera matched
        <br />
        {p.plate}
      </h1>
      <Card>
        <div className="text-xl font-bold">{lot?.name ?? "Waiting for the lot…"}</div>
        <div className={`mt-1 text-4xl font-extrabold ${full ? "text-coral" : lot?.congested ? "text-sun" : "text-mint"}`}>
          {lot ? `${lot.open} of ${lot.total} open` : "--"}
        </div>
        <div className="mt-1 text-soft">{mood.label}</div>
        {p.permit && lot && <div className="mt-3 text-sky">{accessibleOpen} accessible spots open</div>}
      </Card>
      <div>
        <div className="font-bold">
          {full ? "Wait at the entrance" : lot?.congested ? "Follow the guide lights" : "Pick how you want to park"}
        </div>
        <p className="mt-1 text-soft">
          {full
            ? "We'll hold your place and send you to the first spot that opens."
            : lot?.congested
              ? "Keep your eyes on the lane. Voice and guide lights will lead you in."
              : "The lot is quiet, so you can choose what matters to you."}
        </p>
      </div>
      <div className="mt-auto space-y-3">
        {!lot || lot.congested || full ? (
          <Primary onClick={p.onGuide} disabled={!lot}>
            {full ? "Hold my place" : "Follow the guide lights"}
          </Primary>
        ) : (
          <Primary onClick={p.onChoose}>Choose your spot</Primary>
        )}
        <button onClick={p.onBack} className="w-full py-2 text-soft">
          Not my plate
        </button>
      </div>
    </>
  );
}

function Choose(p: {
  lot: LotView | null;
  permit: boolean;
  pref: SpotPref;
  setPref: (v: SpotPref) => void;
  onGo: (pref: SpotPref, spot?: string) => void;
}) {
  const lot = p.lot;
  const pick = lot ? preview(lot, p.permit, p.pref) : null;
  const rows = lot ? groupRows(lot) : [];
  return (
    <>
      <div>
        <h1 className="text-[32px] font-extrabold leading-tight">Choose your spot</h1>
        <p className="text-mint">{lot ? `${lot.open} of ${lot.total} open · ${lotMood(lot).label.split(" - ")[0]}` : "Connecting…"}</p>
      </div>
      <div className="space-y-3">
        {(
          [
            ["building", "Closest to building"],
            ["space", "Space around my car"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => p.setPref(v)}
            className={`w-full rounded-xl px-4 py-3 text-left text-lg font-bold ${p.pref === v ? "bg-sun text-app" : "bg-card text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <Card className="space-y-2 p-4">
        <div className="rounded-lg bg-card-2 py-1.5 text-center font-semibold tracking-wide">BUILDING</div>
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {rows.map(([row, spots]) => (
            <div key={row} className="flex items-center gap-2">
              <span className="w-4 text-soft">{row}</span>
              <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: `repeat(${spots.length}, minmax(0, 1fr))` }}>
                {spots.map((s) => (
                  <span
                    key={s.id}
                    title={s.id}
                    className={`${spots.length > 12 ? "h-4 rounded-sm" : "h-6 rounded"} ${
                      s.id === pick?.id ? "bg-sun" : s.s === 1 || s.s === 3 ? "bg-coral" : s.s === 2 ? "bg-sky" : "bg-mint"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-soft">
          <i className="size-3 rounded-full bg-white" /> ENTRANCE · You
        </div>
      </Card>
      {pick && (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sun px-3 py-2 font-mono font-bold text-app">{pick.id}</div>
          <div>
            <div className="font-bold">
              {pick.id} · {pick.d} m to building
            </div>
            <div className="text-soft">{p.pref === "space" ? "Open spots on both sides" : "Closest available space"}</div>
          </div>
        </div>
      )}
      <div className="mt-auto">
        <Primary onClick={() => p.onGo(p.pref, pick?.id)} disabled={!pick}>
          {pick ? `Go to ${pick.id}` : "No spots open"}
        </Primary>
      </div>
    </>
  );
}

function groupRows(lot: LotView) {
  const rows = new Map<string, LotView["spots"]>();
  for (const s of lot.spots) {
    const r = s.id.replace(/\d+$/, "");
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r)!.push(s);
  }
  return [...rows.entries()];
}

// Mirrors the simulator's choice so the preview matches where the car goes.
function preview(lot: LotView, permit: boolean, pref: SpotPref) {
  const rows = groupRows(lot);
  let best: LotView["spots"][number] | null = null;
  let bestScore = Infinity;
  for (const [, spots] of rows) {
    spots.forEach((s, i) => {
      if (s.s === 1 || s.s === 3) return;
      if (s.s === 2 && !permit) return;
      let score = s.d;
      if (permit && s.s !== 2) score += 1000;
      const sideTaken = [spots[i - 1], spots[i + 1]].some((n) => n && (n.s === 1 || n.s === 3));
      if (pref === "space" && sideTaken) score += 500;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    });
  }
  return best as LotView["spots"][number] | null;
}

function say(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function headline(ins: Instruction, target: string | null): { title: string; sub?: string } {
  switch (ins.kind) {
    case "straight":
      return { title: "Go straight", sub: `${Math.round(ins.distance)} m` };
    case "left":
    case "right":
      return { title: `Turn ${ins.kind}`, sub: `in ${Math.round(ins.distance)} m` };
    case "arrive":
      return { title: `${target ?? "Your spot"} on your ${ins.side}`, sub: `${Math.round(ins.distance)} m` };
    case "wait":
      return { title: `Wait - ${ins.reason.toLowerCase()}` };
    case "stop":
      return { title: "Stop" };
  }
}

function Live(p: {
  car: PhoneCarView | null;
  lot: LotView | null;
  voice: boolean;
  setVoice: (v: boolean) => void;
  leaving: boolean;
  onLeave: () => void;
  discount: boolean;
  setDiscount: (v: boolean) => void;
  onRestart: () => void;
}) {
  const { car, lot } = p;
  const ins = car?.instruction;
  const h = ins ? headline(ins, car?.target ?? null) : null;
  const spoken = useRef("");
  const recentReroute = car?.reroute && lot && lot.simTime - car.reroute.t < 8 ? car.reroute : null;

  useEffect(() => {
    if (!p.voice || !h) return;
    const text = recentReroute ? `${recentReroute.from} was just taken. New spot ${recentReroute.to}.` : `${h.title}${h.sub ? `, ${h.sub}` : ""}`;
    const key = `${h.title}|${recentReroute?.to ?? ""}`;
    if (key === spoken.current) return;
    spoken.current = key;
    say(text.replace(/ - /g, ". "));
  }, [p.voice, h, recentReroute]);

  if (!car || !lot) {
    return <p className="text-soft">Waiting for the entrance camera to see your car…</p>;
  }

  if (car.state === "gone" && !p.leaving) {
    return (
      <>
        <StopSign word="FULL" />
        <h1 className="text-[32px] font-extrabold leading-tight">No spot opened in time</h1>
        <p className="text-soft">The lot stayed full, so we didn&apos;t send you in to circle. Try again in a few minutes.</p>
        <div className="mt-auto">
          <Primary onClick={p.onRestart}>Start over</Primary>
        </div>
      </>
    );
  }

  if (car.state === "park" || car.state === "parked") {
    const parkedFor = car.tParked >= 0 ? lot.simTime - car.tParked : 0;
    const limit = lot.timeLimitMin ? lot.timeLimitMin * 60 - (lot.simTime - car.tIn) : null;
    return (
      <>
        <div className="flex items-center justify-center gap-4 rounded-2xl bg-mint py-5 text-app">
          <svg viewBox="0 0 24 24" className="size-12 fill-none stroke-app stroke-[1.8]" aria-hidden>
            <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M4 11h16v6H4zM6 17v2M18 17v2M7 14h.01M17 14h.01" />
          </svg>
          <span className="font-mono text-6xl font-black">{car.spot}</span>
        </div>
        <div>
          <h1 className="text-[30px] font-extrabold leading-tight">You&apos;re parked at {car.spot}</h1>
          <p className="text-soft">
            Row {car.spot?.replace(/\d+$/, "")} · {lot.name}
          </p>
        </div>
        <Card>
          <div className="text-soft">Time in lot</div>
          <div className="font-mono text-4xl font-bold">{stopwatch(lot.simTime - car.tIn)}</div>
          {limit !== null && (
            <div className={`mt-2 text-sm ${limit < 15 * 60 ? "text-coral" : "text-soft"}`}>
              {limit > 0 ? `${duration(limit)} left before the ${lot.timeLimitMin! / 60} h limit` : "Over the time limit - move your car to avoid a ticket"}
            </div>
          )}
          <div className="sr-only">Parked for {Math.round(parkedFor)} seconds</div>
        </Card>
        {lot.pricePerHour > 0 ? (
          <Card className="space-y-3 text-[15px]">
            <div className="flex justify-between">
              <span className="text-soft">Parking rate</span>
              <b>{money(lot.pricePerHour)}/h</b>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 pt-3">
              Student / senior discount
              <Toggle value={p.discount} onChange={p.setDiscount} />
            </div>
            <p className="text-soft">{money(DISCOUNT)} off with a valid ID. Charged by the minute.</p>
          </Card>
        ) : (
          <Card className="text-soft">Free parking. No ticket needed.</Card>
        )}
        <div className="mt-auto space-y-2">
          <Primary onClick={p.onLeave} disabled={p.leaving || car.state !== "parked"}>
            {p.leaving ? "Backing out…" : "I'm leaving"}
          </Primary>
          <p className="text-soft">Your exit route is ready when you are.</p>
        </div>
      </>
    );
  }

  const exiting = car.state === "unpark" || car.state === "exit" || p.leaving;
  const destination = exiting ? "EXIT" : car.target ?? "…";
  return (
    <>
      {recentReroute ? (
        <div className="-mx-5 -mt-5 flex gap-3 bg-sun px-5 py-4 text-lg font-bold text-app">
          <span aria-hidden>⇄</span>
          {recentReroute.from} was just taken - new spot {recentReroute.to}
        </div>
      ) : (
        <div className="rounded-lg bg-card px-3 py-1.5 text-[15px]">
          {exiting ? `Time in lot ${duration(lot.simTime - car.tIn)}` : `${lot.name} · Stay in lane`}
          {car.permit && !exiting && <span className="ml-2 text-sky">♿ Accessible</span>}
        </div>
      )}
      {ins && (ins.kind === "wait" || ins.kind === "stop") ? (
        <StopSign word="WAIT" />
      ) : ins?.kind === "left" || ins?.kind === "right" ? (
        <Arrow dir={ins.kind} />
      ) : ins?.kind === "arrive" ? (
        <Arrow dir={ins.side} />
      ) : (
        <Arrow dir="straight" />
      )}
      {h && (
        <div>
          <h1 className="text-[34px] font-extrabold leading-tight">{h.title}</h1>
          {h.sub && <div className="font-mono text-4xl font-bold text-sun">{h.sub}</div>}
          {recentReroute && (
            <div className="mt-2 text-sun">✓ Route updated in {recentReroute.latency.toFixed(1)} s</div>
          )}
        </div>
      )}
      <div className="mt-auto">
        <TargetCard label={exiting ? "Destination" : "Target spot"} value={destination} voice={p.voice} setVoice={p.setVoice} />
      </div>
    </>
  );
}

function bill(car: PhoneCarView, lot: LotView) {
  const secs = Math.max(60, car.tOut - car.tIn);
  return { secs, subtotal: parkingCost(secs, lot.pricePerHour) };
}

function total(car: PhoneCarView, lot: LotView, discount: boolean) {
  const { subtotal } = bill(car, lot);
  return Math.max(0, subtotal - (discount ? DISCOUNT : 0));
}

function BillCard({ car, lot, discount }: { car: PhoneCarView; lot: LotView; discount: boolean }) {
  const { secs, subtotal } = bill(car, lot);
  return (
    <Card className="space-y-1 text-[15px]">
      <div className="flex justify-between text-lg font-bold">
        <span>{car.plate}</span>
        <span>Spot {car.spot}</span>
      </div>
      <div className="flex justify-between text-soft">
        <span>Entry {clock(car.tIn, false)}</span>
        <span>Exit {clock(car.tOut, false)}</span>
      </div>
      <div className="flex justify-between text-soft">
        <span>{duration(secs)}</span>
        <span>{money(lot.pricePerHour)}/h</span>
      </div>
      <div className="flex justify-between border-t border-white/10 pt-2 text-soft">
        <span>Subtotal · per minute</span>
        <span className="text-white">{money(subtotal)}</span>
      </div>
      {discount && (
        <div className="flex justify-between text-soft">
          <span>Student discount</span>
          <span className="text-white">−{money(DISCOUNT)}</span>
        </div>
      )}
      <div className="flex items-end justify-between pt-1">
        <span className="text-lg font-bold">Total</span>
        <span className="text-3xl font-extrabold text-sun">{money(total(car, lot, discount))}</span>
      </div>
    </Card>
  );
}

function PaySummary(p: {
  car: PhoneCarView;
  lot: LotView;
  discount: boolean;
  setDiscount: (v: boolean) => void;
  method: Method;
  setMethod: (m: Method) => void;
  onPay: () => void;
  onDone: () => void;
}) {
  if (p.lot.pricePerHour === 0) {
    return (
      <>
        <div className="grid size-16 place-items-center rounded-2xl bg-mint text-3xl text-app">✓</div>
        <h1 className="text-[32px] font-extrabold">No charge - drive safely</h1>
        <Card className="space-y-1 text-[15px]">
          <div className="flex justify-between text-lg font-bold">
            <span>{p.car.plate}</span>
            <span>Spot {p.car.spot}</span>
          </div>
          <div className="flex justify-between text-soft">
            <span>Entry {clock(p.car.tIn, false)}</span>
            <span>Exit {clock(p.car.tOut, false)}</span>
          </div>
          <div className="text-soft">{duration(p.car.tOut - p.car.tIn)} in the lot</div>
        </Card>
        <p className="text-soft">This lot is free. Follow the EXIT signs.</p>
        <div className="mt-auto">
          <Primary onClick={p.onDone}>Park again</Primary>
        </div>
      </>
    );
  }
  const methods: [Method, string][] = [
    ["card", "Credit/debit card"],
    ["wallet", "Mobile wallet"],
    ["plate", "Pay by plate"],
    ["permit", "Permit/exemption"],
  ];
  return (
    <>
      <h1 className="text-[32px] font-extrabold">Your parking total</h1>
      <BillCard car={p.car} lot={p.lot} discount={p.discount} />
      <label className="flex items-center gap-3 text-[15px]">
        Student / senior discount
        <Toggle value={p.discount} onChange={p.setDiscount} />
      </label>
      <div className="space-y-2.5">
        <div className="font-bold">Payment method</div>
        {methods.map(([m, label]) => (
          <button
            key={m}
            onClick={() => p.setMethod(m)}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left font-bold ${
              p.method === m ? "bg-sun text-app" : "border border-white/15 bg-card"
            }`}
          >
            {label}
            {p.method === m && <span>✓</span>}
          </button>
        ))}
      </div>
      <div className="mt-auto">
        <Primary onClick={p.onPay}>Pay {money(total(p.car, p.lot, p.discount))}</Primary>
      </div>
    </>
  );
}

function MethodDetails(p: { method: Method; plate: string; discount: boolean; onConfirm: () => void }) {
  const auto = p.method === "plate";
  return (
    <>
      <h1 className="text-[32px] font-extrabold leading-tight">How would you like to pay?</h1>
      <div className="flex items-center justify-between rounded-xl bg-sun px-4 py-4 font-bold text-app">
        {{ card: "Credit/debit card", wallet: "Mobile wallet", plate: "Pay by plate", permit: "Permit/exemption" }[p.method]}
        <span>✓</span>
      </div>
      <Card className="space-y-3 text-[15px]">
        <div className="font-bold">{auto ? "Automatic charge at exit" : "Charge now"}</div>
        <p className="text-soft">
          {auto
            ? `The exit camera reads ${p.plate} and charges your linked payment method.`
            : "We charge the card on file. Nothing to tap at the gate."}
        </p>
        <div className="flex justify-between">
          <span className="text-soft">Linked card</span>
          <span>Visa •• 4242 (demo)</span>
        </div>
      </Card>
      {p.discount && (
        <Card className="text-[15px]">
          <div className="font-bold text-sky">Permit/exemption</div>
          <div className="font-semibold">Student discount: {money(DISCOUNT)} applied</div>
        </Card>
      )}
      <div className="mt-auto">
        <Primary onClick={p.onConfirm}>{auto ? "Confirm - charge at exit" : "Confirm payment"}</Primary>
      </div>
    </>
  );
}

function Receipt({ car, lot, discount, onDone }: { car: PhoneCarView; lot: LotView; discount: boolean; onDone: () => void }) {
  return (
    <>
      <div className="grid size-16 place-items-center rounded-2xl bg-mint text-3xl text-app">✓</div>
      <h1 className="text-[32px] font-extrabold">Paid - have a good day</h1>
      <BillCard car={car} lot={lot} discount={discount} />
      <p className="text-soft">
        Visa •• 4242 · Paid {money(total(car, lot, discount))}
      </p>
      <div className="mt-auto space-y-3">
        <div className="flex items-center gap-4 rounded-2xl bg-mint px-5 py-5 text-app">
          <span className="text-5xl font-black">⇥</span>
          <span className="text-3xl font-extrabold leading-tight">Exit gate opening</span>
        </div>
        <p className="text-soft">Follow the EXIT signs. Drive safely.</p>
        <button onClick={onDone} className="w-full py-2 text-soft">
          Park again
        </button>
      </div>
    </>
  );
}

async function recordSession(car: PhoneCarView, lot: LotView, amount: number) {
  const sb = supabase();
  if (!sb) return;
  await sb.from("parking_sessions").insert({
    lot_id: lot.id,
    plate: car.plate,
    spot_id: car.spot,
    sim_entered: Math.round(car.tIn),
    sim_parked: Math.round(car.tParked),
    sim_exited: Math.round(car.tOut),
    amount_cents: Math.round(amount * 100),
  });
}
