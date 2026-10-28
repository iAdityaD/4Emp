import type { SQLiteDatabase } from "expo-sqlite";
import type { WorkProfile } from "../features/planning/models";
import { validateSettings } from "../domain/settingsValidation";
import { db } from "../db/connection";
import { defaultSettings, Settings } from "../domain/models";

type Reader = Pick<SQLiteDatabase, "getAllAsync">;
async function readSettings(reader: Reader): Promise<Settings> {
  const rows = await reader.getAllAsync<{ key: string; value: string }>(
    "SELECT * FROM app_settings",
  );
  const result = { ...defaultSettings };
  for (const row of rows)
    if (row.key in result)
      try {
        Object.assign(result, { [row.key]: JSON.parse(row.value) });
      } catch {
        /* Keep the default for a corrupt legacy preference. */
      }
  return validateSettings(result);
}

async function writeSettings(
  tx: SQLiteDatabase,
  current: Settings,
  patch: Partial<Settings>,
) {
  const next = { ...current, ...patch };
  if (next.useWeeklyTargets) {
    if (
      patch.weekends !== undefined &&
      patch.weekTargets === undefined &&
      patch.useWeeklyTargets !== true
    ) {
      next.weekTargets = next.weekTargets.map((target, i) =>
        next.weekends & (1 << i) ? 0 : target || next.baseline,
      );
    }
    next.weekends = next.weekTargets.reduce(
      (mask, target, i) => (target === 0 ? mask | (1 << i) : mask),
      0,
    );
  }
  const valid = validateSettings(next);
  for (const key of Object.keys(valid) as (keyof Settings)[]) {
    if (JSON.stringify(valid[key]) === JSON.stringify(current[key])) continue;
    await tx.runAsync(
      "INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      JSON.stringify(valid[key]),
    );
  }
}

export const SettingsRepository = {
  load: (): Promise<Settings> => readSettings(db()),
  async update(patch: Partial<Settings>) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      await writeSettings(tx, await readSettings(tx), patch);
    });
  },
  async save<K extends keyof Settings>(key: K, value: Settings[K]) {
    await this.update({ [key]: value } as Partial<Settings>);
  },
  async applyWorkProfile(id: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const profile = await tx.getFirstAsync<WorkProfile>(
        "SELECT * FROM work_profiles WHERE id=? AND is_active=1",
        id,
      );
      if (!profile) throw Error("Profile unavailable");
      if (
        !Number.isInteger(profile.weekdays) ||
        profile.weekdays < 0 ||
        profile.weekdays > 127
      )
        throw Error("Choose valid workdays");
      const current = await readSettings(tx);
      await writeSettings(tx, current, {
        baseline: profile.target_minutes,
        buffer: profile.buffer_minutes,
        mode: profile.tracking_mode,
        cutoff: profile.cutoff_minute,
        defaultShiftType: profile.shift_type,
        // Explicit weekday targets take priority over a profile's uniform default.
        ...(!current.useWeeklyTargets
          ? { weekends: 127 ^ profile.weekdays }
          : {}),
      });
    });
  },
};
