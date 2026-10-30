import {
  Shift,
  Break,
  Settings,
  CalendarMark,
  Holiday,
} from "../domain/models";
import { scheduledMinutes } from "../domain/workSchedule";
import { isFocus } from "../domain/workModes";
import { metrics, clock, dateKey, workDate } from "../domain/shift";
export interface PlannedAlarm {
  channel?: "work" | "finance" | "focus";
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
  const workShifts = shifts.filter((s) => !isFocus(s.shift_type));
  const isWorkday = (day: string) => {
    const mark = marks.find((m) => m.work_date === day);
    if (mark) return mark.kind === "WORKED";
    if (holidays.some((h) => h.holiday_date === day && !h.is_optional))
      return false;
    return (
      workShifts.some((s) => s.work_date === day) ||
      scheduledMinutes(settings, day) > 0
    );
  };
  const muted = (day: string) =>
    marks.some((m) => m.work_date === day && m.kind !== "WORKED") ||
    (marks.find((m) => m.work_date === day)?.kind !== "WORKED" &&
      holidays.some((h) => h.holiday_date === day && !h.is_optional));
  const plan: PlannedAlarm[] = [];
  const push = (a: PlannedAlarm) => {
    if (a.at > now) plan.push(a);
  };
  for (const s of shifts.filter((s) => s.status === "ACTIVE")) {
    const m = metrics(
      s,
      breaks.filter((b) => b.shift_id === s.id),
      now,
    );
    if (isFocus(s.shift_type)) {
      if (
        settings.focusNotifications &&
        s.shift_type === "CUSTOM" &&
        !m.breakActive &&
        !m.review
      )
        push({
          channel: "focus",
          id: `focus-${s.id}-target`,
          at: m.target,
          title: "Focus complete",
          body: "Your focus timer is complete.",
        });
      continue;
    }
    if (!settings.workNotifications || muted(s.work_date)) continue;
    const cutoff = s.cutoff_at ? Date.parse(s.cutoff_at) : Infinity;
    if (!m.review && !(s.tracking_mode === "NET" && m.breakActive)) {
      for (const [name, offset, title, body] of [
        [
          "warning",
          -settings.shiftWarningMinutes * 60000,
          `${settings.shiftWarningMinutes} minutes remaining`,
          `Target: ${clock(m.target)}.`,
        ],
        [
          "target",
          0,
          s.shift_type === "WFH" ? "Work target reached" : "Safe to swipe out",
          `Work target completed. +${s.buffer_minutes}m buffer included.`,
        ],
        [
          "overtime",
          settings.overtimeMinutes * 60000,
          "Overtime check",
          `You are ${settings.overtimeMinutes} minutes past your target.`,
        ],
      ] as const)
        if (
          (name !== "warning" || settings.shiftWarningMinutes > 0) &&
          (name !== "overtime" || settings.overtimeMinutes > 0) &&
          m.target + offset <= cutoff
        )
          push({
            channel: "work",
            id: `shift-${s.id}-${name}`,
            at: m.target + offset,
            title,
            body,
          });
    }
    if (s.cutoff_at)
      push({
        channel: "work",
        id: `cutoff-${s.id}`,
        at: cutoff,
        title: "Shift needs review",
        body: "Confirm your actual swipe-out time when you return.",
      });
  }
  if (settings.workNotifications)
    for (let d = 0; d < 28; d++)
      for (const reminder of settings.reminders.filter((r) => r.enabled)) {
        const at = new Date(now);
        at.setDate(at.getDate() + d);
        at.setHours(
          Math.floor(reminder.minute / 60),
          reminder.minute % 60,
          0,
          0,
        );
        const owner = workShifts.find(
          (s) =>
            s.status === "ACTIVE" &&
            Date.parse(s.first_swipe_in) <= at.getTime() &&
            s.cutoff_at &&
            at.getTime() < Date.parse(s.cutoff_at),
        );
        const day = owner?.work_date ?? workDate(at.getTime(), settings.cutoff);
        const working = isWorkday(day);
        if (
          (reminder.day_scope ?? "WORKDAYS") === "WORKDAYS" ? !working : working
        )
          continue;
        const isoDay = (new Date(day + "T12:00:00").getDay() + 6) % 7;
        if (reminder.days & (1 << isoDay))
          push({
            channel: "work",
            id: `reminder-${reminder.id}-${dateKey(at)}`,
            at: at.getTime(),
            title: reminder.title,
            body: reminder.message,
          });
      }
  // Active timers have priority over optional day schedules within the OS request budget.
  return plan
    .sort(
      (a, b) =>
        Number(a.id.startsWith("reminder-")) -
          Number(b.id.startsWith("reminder-")) || a.at - b.at,
    )
    .slice(0, 60);
}
