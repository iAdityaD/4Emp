import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { installDatabase } from "../src/db/connection";
import { migrations } from "../src/db/schema";
import { TransactionRepository } from "../src/repositories/TransactionRepository";
import { AccountRepository } from "../src/repositories/AccountRepository";
import { CommitmentRepository } from "../src/repositories/CommitmentRepository";
import { ShiftRepository } from "../src/repositories/ShiftRepository";
import { defaultSettings } from "../src/domain/models";
function setup() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const migration of migrations) sql.exec(migration);
  sql.exec(
    "INSERT INTO accounts(id,name,account_type,current_balance,starting_balance,color_hex) VALUES('bank1','Salary','BANK_1',1000,1000,'#fff'),('bank2','Spends','BANK_2',500,500,'#fff'),('cash','Cash','CASH',100,100,'#fff'); INSERT INTO categories VALUES('food','Food','food','#fff',1),('bills','Bills','bill','#fff',1);",
  );
  const adapter = {
    getAllAsync: async (query: string, ...args: (string | number | null)[]) =>
      sql.prepare(query).all(...args),
    getFirstAsync: async (query: string, ...args: (string | number | null)[]) =>
      sql.prepare(query).get(...args) ?? null,
    runAsync: async (query: string, ...args: (string | number | null)[]) =>
      sql.prepare(query).run(...args),
    execAsync: async (query: string) => sql.exec(query),
    withExclusiveTransactionAsync: async (
      fn: (tx: unknown) => Promise<void>,
    ) => {
      sql.exec("BEGIN");
      try {
        await fn(adapter);
        sql.exec("COMMIT");
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  installDatabase(adapter as unknown as SQLiteDatabase);
  return sql;
}
test("transfer is atomic, preserves liquidity and rolls back invalid destination", async () => {
  const sql = setup();
  await TransactionRepository.create({
    accountId: "bank1",
    destinationId: "bank2",
    type: "TRANSFER",
    amount: 125.25,
  });
  assert.equal(
    sql.prepare("SELECT current_balance FROM accounts WHERE id='bank1'").get()!
      .current_balance,
    874.75,
  );
  assert.equal(
    sql.prepare("SELECT SUM(current_balance) total FROM accounts").get()!.total,
    1600,
  );
  await assert.rejects(() =>
    TransactionRepository.create({
      accountId: "bank1",
      destinationId: "missing",
      type: "TRANSFER",
      amount: 10,
    }),
  );
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM transactions").get()!.n, 1);
  sql.close();
});
test("reimbursement settles once to chosen account, not personal income", async () => {
  const sql = setup();
  const id = await TransactionRepository.create({
    accountId: "bank1",
    type: "EXPENSE",
    amount: 75.15,
    categoryId: "food",
    reimbursable: true,
  });
  await TransactionRepository.settle(id, "bank2");
  assert.equal(
    sql.prepare("SELECT current_balance FROM accounts WHERE id='bank2'").get()!
      .current_balance,
    575.15,
  );
  assert.equal(
    sql
      .prepare(
        "SELECT COUNT(*) n FROM transactions WHERE type='INCOME' AND ledger_kind='PERSONAL'",
      )
      .get()!.n,
    0,
  );
  await assert.rejects(() => TransactionRepository.settle(id, "cash"));
  assert.equal(
    sql.prepare("SELECT SUM(current_balance) total FROM accounts").get()!.total,
    1600,
  );
  sql.close();
});
test("opening correction is audited and cents remain stable", async () => {
  const sql = setup();
  await AccountRepository.rebalance("cash", "Wallet", 200.25);
  assert.equal(
    sql.prepare("SELECT ledger_kind FROM transactions").get()!.ledger_kind,
    "ADJUSTMENT",
  );
  for (let i = 0; i < 10; i++)
    await TransactionRepository.create({
      accountId: "cash",
      type: "EXPENSE",
      amount: 0.1,
    });
  assert.equal(
    sql.prepare("SELECT current_balance FROM accounts WHERE id='cash'").get()!
      .current_balance,
    199.25,
  );
  sql.close();
});
test("commitment payment is idempotent per cycle", async () => {
  const sql = setup();
  await CommitmentRepository.add({
    title: "EMI",
    amount: 100,
    due_day_of_month: 31,
    account_id: "bank1",
    commitment_type: "EMI",
  });
  const c = (await CommitmentRepository.all())[0]!;
  await CommitmentRepository.pay(c, "2026-10-01");
  await assert.rejects(() => CommitmentRepository.pay(c, "2026-10-01"));
  assert.equal(
    sql.prepare("SELECT COUNT(*) n FROM commitment_payments").get()!.n,
    1,
  );
  assert.equal(
    sql.prepare("SELECT current_balance FROM accounts WHERE id='bank1'").get()!
      .current_balance,
    900,
  );
  sql.close();
});
test("foreign keys enforce relationships and active shift uniqueness; flexible target snapshots", async () => {
  const sql = setup();
  await ShiftRepository.start("CUSTOM", 420, { ...defaultSettings, buffer: 3 });
  const active = (await ShiftRepository.all())[0]!;
  assert.equal(active.target_minutes, 420);
  assert.equal(active.buffer_minutes, 3);
  await assert.rejects(() =>
    ShiftRepository.start("OFFICE", 0, defaultSettings),
  );
  await ShiftRepository.toggleBreak(active);
  await ShiftRepository.toggleBreak(active);
  assert.equal((await ShiftRepository.breaks()).length, 1);
  await ShiftRepository.complete(active);
  assert.equal((await ShiftRepository.all())[0]!.status, "COMPLETED");
  assert.throws(() =>
    sql
      .prepare(
        "INSERT INTO shift_breaks(id,shift_id,break_start) VALUES('x','missing','2026-01-01')",
      )
      .run(),
  );
  sql.close();
});
