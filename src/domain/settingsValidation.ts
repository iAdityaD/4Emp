import { z } from "zod";
import { defaultSettings, Settings } from "./models";
const minute = z.number().int().min(0).max(1439);
export const settingsSchema = z.object({
  focusNotifications: z.boolean().default(true),
  focusTarget: z.number().int().min(1).max(1440).default(25),
  baseline: z.number().int().min(1).max(1440),
  buffer: z.number().int().min(0).max(60),
  cutoff: minute,
  mode: z.enum(["GROSS", "NET"]),
  weekends: z.number().int().min(0).max(127),
  officeDays: z.number().int().min(0).max(7),
  notifications: z.boolean(),
  financeNotifications: z.boolean(),
  workNotifications: z.boolean(),
  lock: z.boolean(),
  onboarded: z.boolean(),
  theme: z.enum(["system", "dark", "light"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  cycleDay: z.number().int().min(1).max(31),
  reminders: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(100),
        message: z.string().max(500),
        minute,
        days: z.number().int().min(1).max(127),
        enabled: z.boolean(),
        day_scope: z.enum(["WORKDAYS", "DAYS_OFF"]).default("WORKDAYS"),
      }),
    )
    .max(50),
  accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  financeReminderMinute: minute,
  hideBalances: z.boolean(),
  weekTargets: z.array(z.number().int().min(0).max(1440)).length(7),
  startOfDay: minute,
  useWeeklyTargets: z.boolean(),
  defaultShiftType: z.enum([
    "OFFICE",
    "WFH",
    "HALF_DAY",
    "CUSTOM",
    "OPEN_ENDED",
  ]),
  shiftWarningMinutes: z.number().int().min(0).max(240),
  overtimeMinutes: z.number().int().min(0).max(1440),
});
export function validateSettings(partial: unknown): Settings {
  return settingsSchema.parse({ ...defaultSettings, ...(partial as object) });
}
