// Scenarios start at 10:00 on the simulated clock.
export const START_HOUR = 10;

export function clock(t: number, seconds = true) {
  const total = Math.floor(START_HOUR * 3600 + t);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return seconds ? `${hm}:${String(s).padStart(2, "0")}` : hm;
}

export function duration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function stopwatch(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

export function money(v: number) {
  return `$${v.toFixed(2)}`;
}

// Parking is billed by the minute.
export function parkingCost(sec: number, perHour: number) {
  return Math.ceil(sec / 60) * (perHour / 60);
}
