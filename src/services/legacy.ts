import { db } from "../db/connection";
import { native } from "./native";
import { dateKey, cutoffWindow } from "../domain/shift";
export async function importLegacy() {
  if (
    await db().getFirstAsync(
      "SELECT key FROM schema_metadata WHERE key='legacy_imported'",
    )
  )
    return;
  const old = JSON.parse((await native?.getLegacy()) ?? "{}") as Record<
    string,
    unknown
  >;
  await db().withExclusiveTransactionAsync(async (tx) => {
    const legacy = JSON.parse(String(old.shifts ?? "[]")) as Array<{
      in: number;
      out: number;
      workMinutes?: number;
    }>;
    for (let i = 0; i < legacy.length; i++) {
      const s = legacy[i]!;
      if (!s.in) continue;
      const cutoff = cutoffWindow(s.in, 1439).end;
      await tx.runAsync(
        "INSERT OR IGNORE INTO work_shifts(id,work_date,tracking_mode,shift_type,target_minutes,buffer_minutes,first_swipe_in,last_swipe_out,status,created_at,cutoff_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        `legacy-${i}`,
        dateKey(s.in),
        "GROSS",
        "OFFICE",
        s.workMinutes ?? 540,
        0,
        new Date(s.in).toISOString(),
        s.out ? new Date(s.out).toISOString() : null,
        s.out ? "COMPLETED" : Date.now() >= cutoff ? "NEEDS_REVIEW" : "ACTIVE",
        s.in,
        new Date(cutoff).toISOString(),
      );
    }
    const marks = JSON.parse(String(old.calendarDays ?? "{}")) as Record<
      string,
      string
    >;
    for (const [date, kind] of Object.entries(marks))
      if (kind === "holiday")
        await tx.runAsync(
          "INSERT OR IGNORE INTO company_holidays(id,holiday_date,title) VALUES(?,?,?)",
          `legacy-${date}`,
          date,
          "Personal holiday",
        );
      else if (["leave", "worked"].includes(kind))
        await tx.runAsync(
          "INSERT OR IGNORE INTO calendar_marks(work_date,kind) VALUES(?,?)",
          date,
          kind.toUpperCase(),
        );
    if (typeof old.workMinutes === "number")
      await tx.runAsync(
        "INSERT OR REPLACE INTO app_settings VALUES(?,?)",
        "baseline",
        JSON.stringify(old.workMinutes),
      );
    if (typeof old.weekends === "number")
      await tx.runAsync(
        "INSERT OR REPLACE INTO app_settings VALUES(?,?)",
        "weekends",
        JSON.stringify(old.weekends),
      );
    if (typeof old.notifications === "boolean")
      await tx.runAsync(
        "INSERT OR REPLACE INTO app_settings VALUES(?,?)",
        "notifications",
        JSON.stringify(old.notifications),
      );
    if (old.reminders) {
      const oldReminders = JSON.parse(String(old.reminders)) as Array<{
        id: number;
        title: string;
        message: string;
        time: number;
        days: number;
        enabled: boolean;
      }>;
      await tx.runAsync(
        "INSERT OR REPLACE INTO app_settings VALUES(?,?)",
        "reminders",
        JSON.stringify(
          oldReminders
            .filter((r) => r.id > 2)
            .map((r) => ({
              id: String(r.id),
              title: r.title,
              message: r.message,
              minute: r.time,
              days: r.days,
              enabled: r.enabled,
            })),
        ),
      );
    }
    await tx.runAsync(
      "INSERT INTO schema_metadata VALUES(?,?)",
      "legacy_imported",
      "1",
    );
  });
  await native?.cancelLegacy();
}
