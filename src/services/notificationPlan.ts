import {
  Shift,
  Break,
  Settings,
  CalendarMark,
  Holiday,
} from "../domain/models";
import { scheduledMinutes } from "../domain/workSchedule";
import { metrics, clock, dateKey, workDate } from "../domain/shift";
export interface PlannedAlarm {
  channel?: "work" | "finance";
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
  if (!settings.notifications || !settings.workNotifications) return [];
  const muted = new Set([
    ...marks.filter((m) => m.kind !== "WORKED").map((m) => m.work_date),
    ...holidays.filter((h) => !h.is_optional).map((h) => h.holiday_date),
  ]);
  const plan: PlannedAlarm[] = [];
  const push = (
    alarm: PlannedAlarm,
    day = workDate(alarm.at, settings.cutoff),
  ) => {
    if (alarm.at > now && !muted.has(day)) plan.push(alarm);
  };
  for (const s of shifts.filter((s) => s.status === "ACTIVE")) {
    if (muted.has(s.work_date)) continue;
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
          -settings.shiftWarningMinutes * 60000,
          `${settings.shiftWarningMinutes} minutes remaining`,
          `Target: ${clock(m.target)}.`,
        ],
        [
          "target",
          0,
          s.shift_type === "WFH" ? "Work target reached" : "Safe to swipe out",
          `Mandatory hours completed. +${s.buffer_minutes}m buffer included.`,
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
          push(
            {
              id: `shift-${s.id}-${name}`,
              at: m.target + offset,
              title,
              body,
            },
            s.work_date,
          );
    }
    if (s.shift_type !== "OPEN_ENDED" && s.cutoff_at)
      push(
        {
          id: `cutoff-${s.id}`,
          at: Date.parse(s.cutoff_at),
          title: "Shift needs review",
          body: "The company day has reset. Confirm your actual swipe-out time when you return.",
        },
        s.work_date,
      );
  }
  // OS-owned one-shot requests. Refilled on launch/resume/settings changes, capped for iOS.
  for (let d = 0; d < 28; d++)
    for (const reminder of settings.reminders.filter((r) => r.enabled)) {
      const at = new Date(now);
      at.setDate(at.getDate() + d);
      at.setHours(Math.floor(reminder.minute / 60), reminder.minute % 60, 0, 0);
      const owner = shifts.find(
        (s) =>
          s.status === "ACTIVE" &&
          Date.parse(s.first_swipe_in) <= at.getTime() &&
          s.cutoff_at &&
          at.getTime() < Date.parse(s.cutoff_at),
      );
      const reminderDay =
        owner?.work_date ?? workDate(at.getTime(), settings.cutoff);
      if (
        scheduledMinutes(settings, reminderDay) === 0 &&
        !shifts.some((s) => s.work_date === reminderDay) &&
        !marks.some((m) => m.work_date === reminderDay && m.kind === "WORKED")
      )
        continue;
      const isoDay = (new Date(reminderDay + "T12:00:00").getDay() + 6) % 7;
      if (reminder.days & (1 << isoDay))
        push(
          {
            id: `reminder-${reminder.id}-${dateKey(at)}`,
            at: at.getTime(),
            title: reminder.title,
            body: reminder.message,
          },
          reminderDay,
        );
    }
  return plan.sort((a, b) => a.at - b.at).slice(0, 60);
}
