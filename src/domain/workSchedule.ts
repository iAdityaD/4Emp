import type { Settings, ShiftType } from "./models";
import { cutoffWindow, localDate, shiftTarget, workDate } from "./shift";

export function scheduledMinutes(settings: Settings, day: string): number {
  const weekday = (localDate(day).getDay() + 6) % 7;
  return settings.useWeeklyTargets
    ? settings.weekTargets[weekday]!
    : settings.weekends & (1 << weekday)
      ? 0
      : settings.baseline;
}

export interface StartOptions {
  allowRestDay?: boolean;
  allowLateStart?: boolean;
}

export function shiftStartPlan(
  now: number,
  settings: Settings,
  type: ShiftType,
  custom: number,
  options: StartOptions = {},
) {
  const day = workDate(now, settings.cutoff);
  const scheduled = scheduledMinutes(settings, day);
  const restDay = scheduled === 0;
  const requiresRestConfirmation =
    restDay &&
    type !== "CUSTOM" &&
    type !== "OPEN_ENDED" &&
    !options.allowRestDay;
  const overrideTarget = shiftTarget(
    type,
    scheduled || settings.baseline,
    custom,
  );
  const target = requiresRestConfirmation ? 0 : overrideTarget;
  const effective =
    requiresRestConfirmation || type === "OPEN_ENDED"
      ? 0
      : target + settings.buffer;
  const cutoff = cutoffWindow(now, settings.cutoff).end;
  return {
    day,
    restDay,
    requiresRestConfirmation,
    overrideTarget,
    target,
    cutoff,
    targetAt: now + effective * 60000,
    latest: cutoff - effective * 60000,
    exceedsCutoff: effective > 0 && now + effective * 60000 > cutoff,
  };
}
