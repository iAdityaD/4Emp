import { Break, Shift } from "./models";
import { dateKey, localDate } from "./shift";
import { isFocus } from "./workModes";
const overlap = (a: number, b: number, c: number, d: number) =>
  Math.max(0, Math.min(b, d) - Math.max(a, c));
/** Split actual elapsed intervals at local midnight, deducting only breaks in that day. */
export function sessionDayMillis(
  shift: Shift,
  breaks: Break[],
  day: string,
  now = Date.now(),
) {
  const from = localDate(day),
    to = new Date(from);
  to.setDate(to.getDate() + 1);
  const start = Date.parse(shift.first_swipe_in);
  const end = shift.last_swipe_out
    ? Date.parse(shift.last_swipe_out)
    : Math.min(now, shift.cutoff_at ? Date.parse(shift.cutoff_at) : Infinity);
  const gross = overlap(start, end, from.getTime(), to.getTime());
  if (shift.tracking_mode === "GROSS") return gross;
  const paused = breaks
    .filter((b) => b.shift_id === shift.id)
    .reduce(
      (n, b) =>
        n +
        overlap(
          Math.max(start, Date.parse(b.break_start)),
          Math.min(end, b.break_end ? Date.parse(b.break_end) : end),
          from.getTime(),
          to.getTime(),
        ),
      0,
    );
  return Math.max(0, gross - paused);
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
