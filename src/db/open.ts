import * as SQLite from "expo-sqlite";
/** Expo's exclusive transactions open a fresh connection: connection-local FK and busy-timeout pragmas must be applied before BEGIN. */
export async function openDatabase(name: string) {
  const database = await SQLite.openDatabaseAsync(name);
  await database.execAsync(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  database.withExclusiveTransactionAsync = async (task) => {
    const tx = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
    let began = false;
    try {
      await tx.execAsync(
        "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;",
      );
      began = true;
      await task(tx);
      await tx.execAsync("COMMIT");
      began = false;
    } catch (e) {
      if (began) await tx.execAsync("ROLLBACK");
      throw e;
    } finally {
      await tx.closeAsync();
    }
  };
  return database;
}
