import type { SQLiteDatabase } from "expo-sqlite";
let connection: SQLiteDatabase;
export const db = () => {
  if (!connection) throw Error("Database not initialized");
  return connection;
};
export function installDatabase(value: SQLiteDatabase) {
  connection = value;
}
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
