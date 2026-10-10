import * as SQLite from "expo-sqlite";
import { migrations } from "./schema";
import { installDatabase } from "./connection";
let database: SQLite.SQLiteDatabase;
export async function initializeDatabase() {
  database = await SQLite.openDatabaseAsync("employee.db");
  installDatabase(database);
  await database.execAsync(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  const row = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if ((row?.user_version ?? 0) > migrations.length)
    throw Error("This backup requires a newer app version");
  for (let i = row?.user_version ?? 0; i < migrations.length; i++)
    await database.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(migrations[i]!);
      await tx.execAsync(`PRAGMA user_version=${i + 1}`);
    });
  await database.withExclusiveTransactionAsync(async (tx) => {
    for (const [id, name, type, color] of [
      ["bank1", "Salary account", "BANK_1", "#A8F07A"],
      ["bank2", "Spends account", "BANK_2", "#75DCE9"],
      ["cash", "Cash wallet", "CASH", "#D2B7FF"],
    ])
      await tx.runAsync(
        "INSERT OR IGNORE INTO accounts(id,name,account_type,color_hex) VALUES(?,?,?,?)",
        id!,
        name!,
        type!,
        color!,
      );
    const names = [
      "Food",
      "Commute",
      "Fuel",
      "Shopping",
      "Bills",
      "Groceries",
      "Entertainment",
      "Other",
      "Salary",
    ];
    const icons = [
      "restaurant-outline",
      "bus-outline",
      "car-outline",
      "bag-outline",
      "receipt-outline",
      "basket-outline",
      "film-outline",
      "ellipse-outline",
      "briefcase-outline",
    ];
    for (let i = 0; i < names.length; i++)
      await tx.runAsync(
        "INSERT OR IGNORE INTO categories(id,name,icon_name,color_hex) VALUES(?,?,?,?)",
        names[i]!.toLowerCase(),
        names[i]!,
        icons[i]!,
        ["#A8F07A", "#75DCE9", "#D2B7FF", "#FDBA74"][i % 4]!,
      );
  });
}
