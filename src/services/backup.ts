import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import * as Picker from "expo-document-picker";
import { db } from "../db/connection";
import { backupTables, migrations } from "../db/schema";
import { encryptBackup, decryptBackup, csv, Envelope } from "./crypto";
export async function exportBackup(password: string) {
  const tables: Record<string, unknown[]> = {};
  await db().withExclusiveTransactionAsync(async (tx) => {
    for (const table of backupTables)
      tables[table] = await tx.getAllAsync(`SELECT * FROM ${table}`);
  });
  const envelope = await encryptBackup(
    JSON.stringify({ schemaVersion: migrations.length, tables }),
    password,
    Crypto.getRandomBytes(16),
    Crypto.getRandomBytes(12),
  );
  await share(
    "4Employee-backup.encrypted.json",
    JSON.stringify(envelope),
    "application/json",
  );
}
async function share(name: string, content: string, mime: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("File sharing is unavailable on this device");
  const uri = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(uri, content);
  try {
    await Sharing.shareAsync(uri, {
      mimeType: mime,
      dialogTitle: "Save your private export",
    });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
export async function exportCSV(domain: "transactions" | "work_shifts") {
  const rows = await db().getAllAsync<Record<string, string | number | null>>(
    `SELECT * FROM ${domain}`,
  );
  const columns = await db().getAllAsync<{ name: string }>(
    `PRAGMA table_info(${domain})`,
  );
  const names = columns.map((c) => c.name);
  await share(
    `4Employee-${domain}.csv`,
    csv([names, ...rows.map((row) => names.map((name) => row[name]))]),
    "text/csv",
  );
}
export async function restoreBackup(password: string) {
  const file = await Picker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (file.canceled) return false;
  const asset = file.assets[0]!;
  if ((asset.size ?? 0) > 25000000) throw Error("Backup is too large");
  let raw: string;
  try {
    raw = await FileSystem.readAsStringAsync(asset.uri);
  } finally {
    await FileSystem.deleteAsync(asset.uri, { idempotent: true });
  }
  const decoded = JSON.parse(
    await decryptBackup(JSON.parse(raw) as Envelope, password),
  ) as {
    schemaVersion: number;
    tables: Record<string, Record<string, string | number | null>[]>;
  };
  if (decoded.schemaVersion !== migrations.length || !decoded.tables)
    throw Error("Backup schema does not match this app");
  await db().withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync("PRAGMA defer_foreign_keys=ON;");
    for (const table of [...backupTables].reverse())
      await tx.runAsync(`DELETE FROM ${table}`);
    for (const table of backupTables) {
      const rows = decoded.tables[table];
      if (!Array.isArray(rows) || rows.length > 100000)
        throw Error(`Invalid ${table} data`);
      const columns = await tx.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${table})`,
      );
      const names = columns.map((c) => c.name);
      for (const row of rows) {
        if (!row || Object.keys(row).some((key) => !names.includes(key)))
          throw Error("Unknown backup fields");
        const keys = Object.keys(row);
        if (
          !keys.length ||
          Object.values(row).some(
            (v) => v !== null && typeof v !== "string" && typeof v !== "number",
          )
        )
          throw Error("Invalid row");
        await tx.runAsync(
          `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
          ...keys.map((k) => row[k] ?? null),
        );
      }
    }
    if ((await tx.getAllAsync("PRAGMA foreign_key_check")).length)
      throw Error("Backup has invalid relationships");
    if (
      (
        await tx.getAllAsync(
          "SELECT id FROM work_shifts WHERE target_minutes<0 OR target_minutes>1440 OR buffer_minutes<0 OR buffer_minutes>60",
        )
      ).length
    )
      throw Error("Invalid work durations");
    if (
      (await tx.getAllAsync("SELECT id FROM transactions WHERE amount<=0"))
        .length
    )
      throw Error("Invalid transaction amounts");
    const config = await tx.getAllAsync<{ key: string; value: string }>(
      "SELECT * FROM app_settings",
    );
    for (const item of config) {
      const value: unknown = JSON.parse(item.value);
      if (
        ["baseline", "cutoff", "cycleDay", "buffer"].includes(item.key) &&
        typeof value !== "number"
      )
        throw Error("Invalid settings");
    }
  });
  return true;
}
