import { CONGESTED_AT, type Car, type Sim } from "@/sim/engine";
import type { Rect } from "@/sim/types";

// Colours sampled from the Figma parking console kit.
export const C = {
  bg: "#0d1216",
  ground: "#122019", // grass islands and verges
  road: "#1a2227",
  asphalt: "#1c252b",
  line: "#2a363e",
  text: "#c9d2d6",
  muted: "#6b7a82",
  lime: "#b7f36b",
  amber: "#f0c24b",
  red: "#e07a7a",
  open: "#c9d6bf",
  openText: "#1d2a1c",
  dim: "#1f2d1e",
  dimLine: "#2f4a2a",
  dimText: "#6d8a66",
  taken: "#232d34",
  access: "#b9d3e6",
  accessText: "#17324a",
  blue: "#4b8fd6",
};

export const BODY = ["#8a9aa6", "#a8907a", "#7f9c8c", "#9a8aa8", "#b0a27a"];

export interface DrawOpts {
  highlight: Set<string>; // plates to mark (phone drivers)
  view?: Rect | null; // part of the lot to show; null fits the whole lot
}

// Screen transform used for a frame, so pointer input can be mapped back.
export interface Frame {
  k: number; // pixels per metre
  ox: number;
  oy: number;
}

export function fit(view: Rect, cw: number, ch: number, pad = 10): Frame {
  const k = Math.min((cw - pad * 2) / view.w, (ch - pad * 2) / view.h);
  return { k, ox: (cw - view.w * k) / 2 - view.x * k, oy: (ch - view.h * k) / 2 - view.y * k };
}

export function drawLot(canvas: HTMLCanvasElement, sim: Sim, opts: DrawOpts): Frame | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const lot = sim.lot;
  const frame = fit(opts.view ?? lot.bounds, cw, ch);
  const { k, ox, oy } = frame;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);

  const px = 1 / k; // one screen pixel in metres
  const far = k < 4; // zoomed out: simplify
  const traffix = sim.mode === "traffix";
  const congested = sim.occupancy >= CONGESTED_AT;
  const B = lot.bounds;

  // Ground, then the streets around the site.
  ctx.fillStyle = C.ground;
  ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.lineCap = "butt";
  for (const st of lot.streets) {
    ctx.strokeStyle = C.road;
    ctx.lineWidth = st.width;
    ctx.beginPath();
    ctx.moveTo(st.from.x, st.from.y);
    ctx.lineTo(st.to.x, st.to.y);
    ctx.stroke();
    ctx.strokeStyle = "#3a4650";
    ctx.lineWidth = Math.max(0.15, px);
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    const vertical = Math.abs(st.to.y - st.from.y) > Math.abs(st.to.x - st.from.x);
    const mx = (st.from.x + st.to.x) / 2;
    const my = (st.from.y + st.to.y) / 2;
    text(ctx, st.name.toUpperCase(), mx, my, Math.min(10 * px, st.width * 0.45), "#7d8b93", "center", true, vertical ? -Math.PI / 2 : 0);
  }

  // Paving: drive lanes plus the spot rows. Gaps between rows stay grass.
  ctx.strokeStyle = C.asphalt;
  ctx.lineWidth = lot.aisleWidth;
  ctx.lineCap = "square";
  ctx.beginPath();
  lot.adj.forEach((edges, i) => {
    for (const e of edges) {
      if (e.to < i) continue;
      ctx.moveTo(lot.nodes[i].x, lot.nodes[i].y);
      ctx.lineTo(lot.nodes[e.to].x, lot.nodes[e.to].y);
    }
  });
  ctx.stroke();
  ctx.fillStyle = C.asphalt;
  for (const s of lot.spots) ctx.fillRect(s.rect.x - 0.05, s.rect.y - 0.05, s.rect.w + 0.1, s.rect.h + 0.1);

  // Store, with a faint roof grid.
  const b = lot.building;
  ctx.fillStyle = "#222c33";
  ctx.strokeStyle = "#3a4852";
  ctx.lineWidth = 1.5 * px;
  roundRect(ctx, b.x, b.y, b.w, b.h, 0.6);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#28333a";
  ctx.lineWidth = px;
  ctx.beginPath();
  for (let x = b.x + 10; x < b.x + b.w; x += 10) {
    ctx.moveTo(x, b.y);
    ctx.lineTo(x, b.y + b.h);
  }
  ctx.stroke();
  text(ctx, b.label.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2, Math.min(13 * px, b.w / 12), C.text, "center", true);

  // Row labels.
  if (k >= 3) {
    const labelSize = Math.min(11 * px, 2.2);
    for (const r of lot.rowLabels) text(ctx, r.label, r.x, r.y, labelSize, C.muted, "center", true);
  }

  // Spots. Zoomed out, a taken spot is filled with its car's colour.
  const showIds = k > 6.5;
  const inset = far ? 0.2 : 0.12;
  for (let i = 0; i < lot.spots.length; i++) {
    const s = lot.spots[i];
    const r = s.rect;
    const x = r.x + inset;
    const y = r.y + inset;
    const w = r.w - inset * 2;
    const h = r.h - inset * 2;
    const taken = sim.occ[i] >= 0;
    const held = traffix && sim.hold[i] >= 0;
    let fill = C.open;
    let ink = C.openText;
    let stroke: string | null = null;
    if (taken) {
      fill = far ? BODY[sim.occ[i] % BODY.length] : C.taken;
      ink = C.muted;
      stroke = far ? null : C.line;
    } else if (held) {
      fill = "#253c24";
      ink = C.lime;
      stroke = C.lime;
    } else if (s.accessible) {
      fill = C.access;
      ink = C.accessText;
    } else if (traffix && congested) {
      fill = C.dim;
      ink = C.dimText;
      stroke = far ? null : C.dimLine;
    }
    ctx.fillStyle = fill;
    if (far) ctx.fillRect(x, y, w, h);
    else {
      roundRect(ctx, x, y, w, h, 0.25);
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = (held ? 2 : 1) * px;
      if (far) ctx.strokeRect(x, y, w, h);
      else ctx.stroke();
    }
    if (showIds) text(ctx, s.id, x + w / 2, y + 0.6, Math.min(8.5 * px, w * 0.32), ink, "center", true);
    if (s.accessible && !taken && k >= 3) {
      text(ctx, "♿", x + w / 2, y + h / 2, Math.min(12 * px, Math.min(w, h) * 0.8), held ? C.lime : C.blue, "center");
    }
  }

  // Guide lights: lit dots along each guided car's route while congested,
  // and always for drivers using the phone app.
  if (traffix) {
    ctx.fillStyle = C.lime;
    for (const car of sim.cars) {
      if (car.state !== "route" || car.target < 0) continue;
      if (!congested && !opts.highlight.has(car.plate)) continue;
      dots(ctx, sim.routePoints(car), Math.max(2.2, 5 * px), Math.max(0.32, 1.2 * px));
    }
  }

  // Cars. Parked cars are already shown by their spot colour when zoomed out.
  for (const car of sim.cars) {
    const mine = opts.highlight.has(car.plate);
    if (far && car.state === "parked" && !mine) continue;
    drawCar(ctx, sim, car, px, mine);
  }

  // Entrance / exit labels.
  const both = (e: number) => lot.exits.includes(e);
  for (const e of lot.entrances) label(ctx, both(e) ? "IN / OUT" : "ENTRANCE", lot.nodes[e].x, lot.nodes[e].y, px, C.lime);
  for (const e of lot.exits) {
    if (!lot.entrances.includes(e)) label(ctx, "EXIT", lot.nodes[e].x, lot.nodes[e].y + 0.5, px, C.text);
  }
  label(ctx, "DOOR", lot.door.x, lot.door.y, px, C.amber);
  return frame;
}

function drawCar(ctx: CanvasRenderingContext2D, sim: Sim, car: Car, px: number, mine: boolean) {
  // Keep moving cars visible when zoomed far out.
  const grow = Math.max(1, (3.5 * px) / 1.9);
  const W = 1.9 * grow;
  const L = 4.3 * Math.min(grow, 1.4);
  let angle = Math.atan2(car.hy, car.hx) + Math.PI / 2;
  if (car.state === "parked" || car.state === "park" || car.state === "unpark") {
    const s = sim.lot.spots[car.spot];
    if (s) {
      const a = sim.lot.nodes[s.access];
      angle = Math.atan2(s.center.y - a.y, s.center.x - a.x) + Math.PI / 2;
    }
  }
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(angle);
  const circling = car.state === "search" && sim.t - car.tIn > 60;
  ctx.fillStyle = BODY[car.id % BODY.length];
  roundRect(ctx, -W / 2, -L / 2, W, L, 0.45);
  ctx.fill();
  if (grow < 1.5) {
    ctx.fillStyle = "#3b4a54";
    roundRect(ctx, -W / 2 + 0.25, -L / 2 + 0.7, W - 0.5, 0.9, 0.2);
    ctx.fill();
    ctx.fillStyle = "#e9ece6";
    ctx.fillRect(-0.45, L / 2 - 0.45, 0.9, 0.3);
  }
  if (circling || mine || car.state === "queued") {
    ctx.strokeStyle = mine ? C.lime : car.state === "queued" ? C.muted : C.amber;
    ctx.lineWidth = 2 * px;
    roundRect(ctx, -W / 2 - 0.3, -L / 2 - 0.3, W + 0.6, L + 0.6, 0.6);
    ctx.stroke();
  }
  ctx.restore();
  if (mine) label(ctx, car.plate, car.x, car.y - 3.6, px, C.lime);
}

function dots(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], step: number, r: number) {
  let carry = step / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = carry; d < len; d += step) {
      ctx.beginPath();
      ctx.arc(a.x + ((b.x - a.x) * d) / len, a.y + ((b.y - a.y) * d) / len, r, 0, Math.PI * 2);
      ctx.fill();
    }
    carry = (carry - len) % step;
    if (carry < 0) carry += step;
  }
}

let fonts: { mono: string; sans: string } | null = null;

// Canvas can't read CSS variables, so resolve the next/font families once.
function family(mono: boolean) {
  if (!fonts) {
    const css = getComputedStyle(document.body);
    fonts = {
      mono: `${css.getPropertyValue("--font-jetbrains").trim() || "ui-monospace"}, monospace`,
      sans: `${css.getPropertyValue("--font-inter").trim() || "system-ui"}, sans-serif`,
    };
  }
  return mono ? fonts.mono : fonts.sans;
}

// Text is drawn in screen space so small lot-scale font sizes stay crisp.
function toScreen(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const m = ctx.getTransform();
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, scale: m.a };
}

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, color: string) {
  const p = toScreen(ctx, x, y);
  const dpr = p.scale * px;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `600 ${10 * dpr}px ${family(true)}`;
  const w = ctx.measureText(s).width + 10 * dpr;
  // Keep labels inside the canvas.
  p.x = Math.min(ctx.canvas.width - w / 2 - 2 * dpr, Math.max(w / 2 + 2 * dpr, p.x));
  const h = 17 * dpr;
  ctx.fillStyle = "rgba(13,18,22,0.92)";
  ctx.strokeStyle = color;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, 2 * dpr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, p.x, p.y + 0.5 * dpr);
  ctx.restore();
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number, // metres
  color: string,
  align: CanvasTextAlign,
  mono = false,
  rotate = 0,
) {
  const p = toScreen(ctx, x, y);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, p.x, p.y);
  if (rotate) ctx.rotate(rotate);
  ctx.font = `600 ${size * p.scale}px ${family(mono)}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
