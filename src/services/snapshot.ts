import type { SQLiteDatabase } from "expo-sqlite";
import { z } from "zod";
import {
  planSchemas,
  planTables,
  PlanKind,
} from "../repositories/PlanningRepository";
import { backupTables, migrations } from "../db/schema";
import { validateSettings } from "../domain/settingsValidation";
const row = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.union([z.string(), z.number().finite(), z.null()]),
);
export const snapshotSchema = z.object({
  schemaVersion: z.number().int().min(1).max(migrations.length),
  tables: z.record(z.string(), z.array(row).max(100000)),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export async function readSnapshot(
  database: SQLiteDatabase,
): Promise<Snapshot> {
  const tables: Snapshot["tables"] = {};
  await database.withExclusiveTransactionAsync(async (tx) => {
    for (const table of backupTables)
      tables[table] = await tx.getAllAsync(`SELECT * FROM ${table}`);
  });
  return { schemaVersion: migrations.length, tables };
}
export async function replaceSnapshot(
  database: SQLiteDatabase,
  input: unknown,
) {
  const data = snapshotSchema.parse(input);
  if (data.schemaVersion !== migrations.length)
    throw Error("Backup must be migrated before restoring");
  await database.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync("PRAGMA defer_foreign_keys=ON");
    for (const table of [...backupTables].reverse())
      await tx.runAsync(`DELETE FROM ${table}`);
    for (const table of backupTables) {
      const rows = data.tables[table];
      if (!rows) throw Error(`Missing backup table: ${table}`);
      const names = (
        await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
      ).map((c) => c.name);
      for (const r of rows) {
        const kind = (Object.keys(planTables) as PlanKind[]).find(
          (k) => planTables[k] === table,
        );
        if (kind) planSchemas[kind].parse(r);
        for (const [key, value] of Object.entries(r)) {
          if (value === null) continue;
          if (
            [
              "transaction_date",
              "contribution_date",
              "first_swipe_in",
              "last_swipe_out",
              "break_start",
              "break_end",
              "cutoff_at",
              "due_at",
              "notification_at",
            ].includes(key) &&
            (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
          )
            throw Error("Invalid date/time in backup");
          if (
            [
              "work_date",
              "holiday_date",
              "occurrence_date",
              "due_date",
            ].includes(key)
          ) {
            if (
              typeof value !== "string" ||
              !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
              new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !==
                value
            )
              throw Error("Invalid calendar date in backup");
          }
          if (
            key === "color_hex" &&
            (typeof value !== "string" || !/^#[a-fA-F0-9]{6}$/.test(value))
          )
            throw Error("Invalid color in backup");
        }
        const keys = Object.keys(r);
        if (!keys.length || keys.some((k) => !names.includes(k)))
          throw Error("Unknown backup fields");
        for (const [key, v] of Object.entries(r))
          if (
            (key.endsWith("_minor") || key === "opening_minor") &&
            v !== null &&
            (!Number.isSafeInteger(v) || Math.abs(Number(v)) > 9e12)
          )
            throw Error("Invalid integer money in backup");
        await tx.runAsync(
          `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
          ...keys.map((k) => r[k] ?? null),
        );
      }
    }
    if ((await tx.getAllAsync("PRAGMA foreign_key_check")).length)
      throw Error("Invalid backup relationships");
    const prefs = await tx.getAllAsync<{ key: string; value: string }>(
      "SELECT * FROM app_settings",
    );
    validateSettings(
      Object.fromEntries(prefs.map((p) => [p.key, JSON.parse(p.value)])),
    );
    if (
      await tx.getFirstAsync(
        "SELECT id FROM transactions WHERE amount_minor<=0",
      )
    )
      throw Error("Invalid transaction amount");
    if (
      await tx.getFirstAsync(
        "SELECT id FROM work_shifts WHERE target_minutes<0 OR target_minutes>1440 OR buffer_minutes<0 OR buffer_minutes>60",
      )
    )
      throw Error("Invalid work durations");
  });
}
