import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { installDatabase } from "../src/db/connection";
import { migrations } from "../src/db/schema";
export function adapter(sql: DatabaseSync) {
  const connection = {
    getAllAsync: async (q: string, ...a: (string | number | null)[]) =>
      sql.prepare(q).all(...a),
    getFirstAsync: async (q: string, ...a: (string | number | null)[]) =>
      sql.prepare(q).get(...a) ?? null,
    runAsync: async (q: string, ...a: (string | number | null)[]) =>
      sql.prepare(q).run(...a),
    execAsync: async (q: string) => sql.exec(q),
    withExclusiveTransactionAsync: async (
      fn: (tx: unknown) => Promise<void>,
    ) => {
      sql.exec("BEGIN");
      try {
        await fn(connection);
        sql.exec("COMMIT");
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return connection as unknown as SQLiteDatabase;
}
export function testDatabase() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const m of migrations) {
    sql.exec("BEGIN");
    sql.exec(m);
    sql.exec("COMMIT");
  }
  sql.exec(
    "INSERT INTO accounts(id,name,account_type,color_hex,opening_minor) VALUES('a','Main bank','BANK','#00A88A',10000000),('b','Other wallet','WALLET','#3B82F6',0);INSERT INTO categories(id,name,icon_name,color_hex,kind) VALUES('food','Food','restaurant-outline','#F7505E','EXPENSE'),('salary','Salary','briefcase-outline','#00A88A','INCOME');",
  );
  installDatabase(adapter(sql));
  return sql;
}
