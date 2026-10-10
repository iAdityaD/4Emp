import { Break, Shift, ShiftType } from "./models";
export const dateKey = (value: Date | number = new Date()): string => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const localDate = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
export function cutoffWindow(now: number, minute: number) {
  const end = new Date(now);
  end.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  if (end.getTime() <= now) end.setDate(end.getDate() + 1);
  const begin = new Date(end);
  begin.setDate(begin.getDate() - 1);
  return { end: end.getTime(), workDate: dateKey(begin) };
}
// A late-evening cutoff belongs to that calendar date; an early-morning cutoff belongs to the previous date.
export function workDate(now: number, minute: number): string {
  const d = new Date(cutoffWindow(now, minute).end);
  if (minute < 720) d.setDate(d.getDate() - 1);
  return dateKey(d);
}
export function shiftTarget(type: ShiftType, baseline: number, custom: number) {
  return type === "OPEN_ENDED"
    ? 0
    : type === "HALF_DAY"
      ? baseline / 2
      : type === "CUSTOM"
        ? custom
        : baseline;
}
export function breakMillis(breaks: Break[], now: number, end?: number) {
  return breaks.reduce(
    (sum, b) =>
      sum +
      Math.max(
        0,
        Math.min(end ?? now, b.break_end ? Date.parse(b.break_end) : now) -
          Date.parse(b.break_start),
      ),
    0,
  );
}
export function metrics(shift: Shift, breaks: Break[], now: number) {
  const start = Date.parse(shift.first_swipe_in),
    cutoff = shift.cutoff_at ? Date.parse(shift.cutoff_at) : Infinity;
  const end = shift.last_swipe_out
    ? Date.parse(shift.last_swipe_out)
    : Math.min(now, cutoff);
  const gross = Math.max(0, end - start),
    pause = breakMillis(breaks, end, end),
    net = Math.max(0, gross - pause);
  const productive = shift.tracking_mode === "NET" ? net : gross;
  const goal =
    shift.shift_type === "OPEN_ENDED"
      ? 0
      : (shift.target_minutes + shift.buffer_minutes) * 60000;
  const target = start + goal + (shift.tracking_mode === "NET" ? pause : 0);
  return {
    gross,
    net,
    pause,
    productive,
    goal,
    target,
    remaining: Math.max(0, goal - productive),
    progress: goal ? Math.min(1, productive / goal) : 0,
    review: !shift.last_swipe_out && now >= cutoff,
    breakActive: breaks.some((b) => !b.break_end),
  };
}
export function safeArrival(
  now: number,
  cutoff: number,
  baseline: number,
  buffer: number,
) {
  const end = cutoffWindow(now, cutoff).end;
  return { cutoff: end, latest: end - (baseline + buffer) * 60000 };
}
export function hours(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export function clock(value: number | string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formTime(value: number | string) {
  const d = new Date(value);
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
