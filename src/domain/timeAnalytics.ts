import { Break, Shift } from "./models";
import { dateKey, localDate } from "./shift";
import { isFocus } from "./workModes";
type Interval = [start: number, end: number];
export const UNLABELLED_FOCUS = "Unlabelled";
const dayBounds = (day: string): Interval => {
  const from = localDate(day),
    to = new Date(from);
  to.setDate(to.getDate() + 1);
  return [from.getTime(), to.getTime()];
};
const total = (intervals: Interval[]) =>
  intervals.reduce((n, [a, b]) => n + (b - a), 0);
/**
 * The stretches of a session that count as active inside [from, to).
 * Gross sessions count every elapsed minute; net sessions (all focus timers)
 * exclude their breaks. Every time statistic is built from these intervals.
 */
export function activeIntervals(
  shift: Shift,
  breaks: Break[],
  from: number,
  to: number,
  now = Date.now(),
): Interval[] {
  const start = Math.max(from, Date.parse(shift.first_swipe_in));
  const end = Math.min(
    to,
    shift.last_swipe_out
      ? Date.parse(shift.last_swipe_out)
      : Math.min(now, shift.cutoff_at ? Date.parse(shift.cutoff_at) : Infinity),
  );
  if (!(end > start)) return [];
  if (shift.tracking_mode === "GROSS") return [[start, end]];
  const pauses = breaks
    .filter((b) => b.shift_id === shift.id)
    .map(
      (b): Interval => [
        Date.parse(b.break_start),
        b.break_end ? Date.parse(b.break_end) : end,
      ],
    )
    .sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  let cursor = start;
  for (const [a, b] of pauses) {
    if (a > cursor) out.push([cursor, Math.min(a, end)]);
    cursor = Math.max(cursor, b);
    if (cursor >= end) break;
  }
  if (cursor < end) out.push([cursor, end]);
  return out.filter(([a, b]) => b > a);
}
/** Split actual elapsed intervals at local midnight, deducting only breaks in that day. */
export function sessionDayMillis(
  shift: Shift,
  breaks: Break[],
  day: string,
  now = Date.now(),
) {
  const [from, to] = dayBounds(day);
  return total(activeIntervals(shift, breaks, from, to, now));
}
export function dailyTimeSeries(
  shifts: Shift[],
  breaks: Break[],
  firstDay: string,
  count = 7,
  now = Date.now(),
) {
  return Array.from({ length: count }, (_, i) => {
    const date = localDate(firstDay);
    date.setDate(date.getDate() + i);
    const day = dateKey(date);
    return shifts.reduce(
      (row, s) => {
        const key = isFocus(s.shift_type) ? "focus" : "work";
        row[key] += sessionDayMillis(s, breaks, day, now);
        return row;
      },
      { day, work: 0, focus: 0 },
    );
  });
}
/**
 * How much of a day's work time was spent in focus: the overlap of focus
 * timers with work sessions. Focus outside work hours is not counted here.
 */
export function focusShare(
  shifts: Shift[],
  breaks: Break[],
  day: string,
  now = Date.now(),
) {
  const [from, to] = dayBounds(day);
  const spans = (focus: boolean) =>
    shifts
      .filter((s) => isFocus(s.shift_type) === focus)
      .flatMap((s) => activeIntervals(s, breaks, from, to, now));
  const work = spans(false),
    focus = spans(true);
  const workMs = total(work);
  const focusInWork = work.reduce(
    (n, [a, b]) =>
      n +
      focus.reduce(
        (m, [c, d]) => m + Math.max(0, Math.min(b, d) - Math.max(a, c)),
        0,
      ),
    0,
  );
  return {
    work: workMs,
    focusInWork,
    share: workMs > 0 ? Math.min(1, focusInWork / workMs) : 0,
  };
}
/** Focus time per label over a run of days, largest first. */
export function focusByLabel(
  shifts: Shift[],
  breaks: Break[],
  firstDay: string,
  count = 7,
  now = Date.now(),
) {
  const [from] = dayBounds(firstDay);
  const last = localDate(firstDay);
  last.setDate(last.getDate() + count);
  const totals = new Map<string, number>();
  for (const s of shifts.filter((x) => isFocus(x.shift_type))) {
    const ms = total(activeIntervals(s, breaks, from, last.getTime(), now));
    if (!ms) continue;
    const label = s.notes?.trim() || UNLABELLED_FOCUS;
    totals.set(label, (totals.get(label) ?? 0) + ms);
  }
  return [...totals]
    .map(([label, ms]) => ({ label, ms }))
    .sort((a, b) => b.ms - a.ms);
}
