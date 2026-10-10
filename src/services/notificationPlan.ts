import {
  Shift,
  Break,
  Settings,
  CalendarMark,
  Holiday,
} from "../domain/models";
import { metrics, clock, dateKey, workDate } from "../domain/shift";
export interface PlannedAlarm {
  id: string;
  at: number;
  title: string;
  body: string;
}
export function notificationPlan(
  shifts: Shift[],
  breaks: Break[],
  settings: Settings,
  marks: CalendarMark[],
  holidays: Holiday[],
  now: number,
): PlannedAlarm[] {
  if (!settings.notifications) return [];
  const muted = new Set([
    ...marks.filter((m) => m.kind !== "WORKED").map((m) => m.work_date),
    ...holidays.filter((h) => !h.is_optional).map((h) => h.holiday_date),
  ]);
  const plan: PlannedAlarm[] = [];
  const push = (alarm: PlannedAlarm) => {
    if (alarm.at > now && !muted.has(dateKey(alarm.at))) plan.push(alarm);
  };
  for (const s of shifts.filter((s) => s.status === "ACTIVE")) {
    if (muted.has(s.work_date) || s.shift_type === "WFH") continue;
    const m = metrics(
      s,
      breaks.filter((b) => b.shift_id === s.id),
      now,
    );
    if (
      s.shift_type !== "OPEN_ENDED" &&
      !m.review &&
      !(s.tracking_mode === "NET" && m.breakActive)
    ) {
      const cutoff = Date.parse(s.cutoff_at ?? "");
      for (const [name, offset, title, body] of [
        [
          "warning",
          -900000,
          "15 minutes remaining",
          `Target: ${clock(m.target)}.`,
        ],
        [
          "target",
          0,
          "Safe to swipe out",
          `Mandatory hours completed. +${s.buffer_minutes}m buffer included.`,
        ],
        [
          "overtime",
          3600000,
          "Overtime check",
          "You are one hour past your target.",
        ],
      ] as const)
        if (m.target + offset <= cutoff)
          push({
            id: `shift-${s.id}-${name}`,
            at: m.target + offset,
            title,
            body,
          });
    }
    if (s.shift_type !== "OPEN_ENDED" && s.cutoff_at)
      push({
        id: `cutoff-${s.id}`,
        at: Date.parse(s.cutoff_at),
        title: "Shift needs review",
        body: "The company day has reset. Confirm your actual swipe-out time when you return.",
      });
  }
  // OS-owned one-shot requests. Refilled on launch/resume/settings changes, capped for iOS.
  for (let d = 0; d < 28; d++)
    for (const reminder of settings.reminders.filter((r) => r.enabled)) {
      const at = new Date(now);
      at.setDate(at.getDate() + d);
      at.setHours(Math.floor(reminder.minute / 60), reminder.minute % 60, 0, 0);
      const isoDay = (at.getDay() + 6) % 7;
      if (reminder.days & (1 << isoDay))
        push({
          id: `reminder-${reminder.id}-${dateKey(at)}`,
          at: at.getTime(),
          title: reminder.title,
          body: reminder.message,
        });
    }
  return plan.sort((a, b) => a.at - b.at).slice(0, 60);
}
