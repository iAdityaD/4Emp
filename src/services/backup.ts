import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import * as Picker from "expo-document-picker";
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import { gcm } from "@noble/ciphers/aes";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { openDatabase } from "../db/open";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { db } from "../db/connection";
import { backupTables, migrations } from "../db/schema";
import { encryptBackup, decryptBackup, csv, Envelope } from "./crypto";
import { readSnapshot, replaceSnapshot, snapshotSchema } from "./snapshot";
export async function exportBackup(password: string) {
  const plain = JSON.stringify(await readSnapshot(db()));
  const envelope = await encryptBackup(
    plain,
    password,
    Crypto.getRandomBytes(16),
    Crypto.getRandomBytes(12),
  );
  await share(
    "4emp-backup.encrypted.json",
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
    `SELECT * FROM ${domain === "transactions" ? "ledger" : domain}`,
  );
  const columns = await db().getAllAsync<{ name: string }>(
    `PRAGMA table_info(${domain === "transactions" ? "ledger" : domain})`,
  );
  const names = columns.map((c) => c.name);
  await share(
    `4emp-${domain}.csv`,
    csv([names, ...rows.map((r) => names.map((n) => r[n]))]),
    "text/csv",
  );
}
/** Old encrypted v2 backups are migrated in an isolated SQLite database before any live data is touched. */
async function migrateBackup(input: unknown) {
  const decoded = snapshotSchema.parse(input);
  if (decoded.schemaVersion === migrations.length) return decoded;
  const temporaryName = `restore-${Crypto.randomUUID()}.db`;
  const temporary = await openDatabase(temporaryName);
  try {
    await temporary.execAsync("PRAGMA foreign_keys=ON");
    for (let i = 0; i < decoded.schemaVersion; i++)
      await temporary.execAsync(migrations[i]!);
    await temporary.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync("PRAGMA defer_foreign_keys=ON");
      for (const [table, rows] of Object.entries(decoded.tables)) {
        if (!(backupTables as readonly string[]).includes(table))
          throw Error("Unknown backup table");
        const columns = (
          await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
        ).map((c) => c.name);
        if (!columns.length)
          throw Error("Table does not belong to this backup version");
        for (const r of rows) {
          const keys = Object.keys(r);
          if (!keys.length || keys.some((k) => !columns.includes(k)))
            throw Error("Invalid legacy backup");
          await tx.runAsync(
            `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
            ...keys.map((k) => r[k] ?? null),
          );
        }
      }
    });
    for (let i = decoded.schemaVersion; i < migrations.length; i++)
      await temporary.withExclusiveTransactionAsync(async (tx) => {
        await tx.execAsync(migrations[i]!);
      });
    return await readSnapshot(temporary);
  } finally {
    await temporary.closeAsync();
    await SQLite.deleteDatabaseAsync(temporaryName);
  }
}
async function preserveDeviceSecurity(
  snapshot: Awaited<ReturnType<typeof migrateBackup>>,
) {
  const settings = await SettingsRepository.load();
  snapshot.tables.app_settings = (snapshot.tables.app_settings ?? []).filter(
    (row) => row.key !== "lock" && row.key !== "onboarded",
  );
  snapshot.tables.app_settings.push(
    { key: "lock", value: JSON.stringify(settings.lock) },
    { key: "onboarded", value: "true" },
  );
  return snapshot;
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
  const decoded = await migrateBackup(
    JSON.parse(await decryptBackup(JSON.parse(raw) as Envelope, password)),
  );
  await replaceSnapshot(db(), await preserveDeviceSecurity(decoded));
  return true;
}
const vaultKeyName = "4emp-device-vault-key";
const vaultPath =
  FileSystem.documentDirectory + "4emp-device-vault.encrypted.json";
export async function saveDeviceSnapshot() {
  let keyHex = await SecureStore.getItemAsync(vaultKeyName);
  if (!keyHex) {
    keyHex = bytesToHex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(vaultKeyName, keyHex, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  const key = hexToBytes(keyHex),
    nonce = Crypto.getRandomBytes(12);
  try {
    const ciphertext = bytesToHex(
      gcm(key, nonce).encrypt(
        utf8ToBytes(JSON.stringify(await readSnapshot(db()))),
      ),
    );
    await FileSystem.writeAsStringAsync(
      vaultPath,
      JSON.stringify({ version: 1, nonce: bytesToHex(nonce), ciphertext }),
    );
  } finally {
    key.fill(0);
  }
}
export async function restoreDeviceSnapshot() {
  const keyHex = await SecureStore.getItemAsync(vaultKeyName);
  if (!keyHex)
    throw Error(
      "No device snapshot key exists. Use a portable encrypted backup.",
    );
  const key = hexToBytes(keyHex);
  try {
    const e = JSON.parse(await FileSystem.readAsStringAsync(vaultPath)) as {
      version: number;
      nonce: string;
      ciphertext: string;
    };
    if (e.version !== 1 || e.nonce.length !== 24)
      throw Error("Invalid device snapshot");
    const plain = new TextDecoder().decode(
      gcm(key, hexToBytes(e.nonce)).decrypt(hexToBytes(e.ciphertext)),
    );
    await replaceSnapshot(
      db(),
      await preserveDeviceSecurity(await migrateBackup(JSON.parse(plain))),
    );
  } finally {
    key.fill(0);
  }
}
