import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { adapter, testDatabase } from "./database";
import { migrations } from "../src/db/schema";
import { PlanningRepository } from "../src/repositories/PlanningRepository";
import { TransactionRepository } from "../src/repositories/TransactionRepository";
import { AccountRepository } from "../src/repositories/AccountRepository";
import { reconcilePlans, postPlanned } from "../src/services/recurrence";
import {
  amortization,
  occurrences,
  suggestedEMI,
  budgetSpent,
  monthTotals,
} from "../src/features/planning/calculations";
import { dateKey } from "../src/domain/shift";
import { readSnapshot, replaceSnapshot } from "../src/services/snapshot";
import { ShiftRepository } from "../src/repositories/ShiftRepository";
import { defaultSettings } from "../src/domain/models";
test("v2 migration preserves old balances, transfer history, settlement and linked commitments", () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const m of migrations.slice(0, 2)) sql.exec(m);
  sql.exec(
    "INSERT INTO accounts VALUES('a','Main','BANK_1',500,374.75,'#FFFFFF',1),('b','Second','BANK_2',0,125.25,'#FFFFFF',1);INSERT INTO transactions(id,account_id,destination_account_id,type,amount,transaction_date,created_at) VALUES('t','a','b','TRANSFER',125.25,'2026-01-01',1);INSERT INTO fixed_commitments VALUES('c','Old bill',12.34,31,'a','OTHER',1);",
  );
  for (const m of migrations.slice(2)) {
    sql.exec("BEGIN");
    sql.exec(m);
    sql.exec("COMMIT");
  }
  assert.equal(
    sql
      .prepare(
        "SELECT current_balance_minor FROM account_balances WHERE id='a'",
      )
      .get()!.current_balance_minor,
    37475,
  );
  assert.equal(
    sql
      .prepare(
        "SELECT current_balance_minor FROM account_balances WHERE id='b'",
      )
      .get()!.current_balance_minor,
    12525,
  );
  assert.equal(
    sql.prepare("SELECT amount_minor FROM fixed_commitments").get()!
      .amount_minor,
    1234,
  );
  assert.equal(sql.prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.ok(
    !sql
      .prepare("PRAGMA table_info(accounts)")
      .all()
      .some((c) => c.name === "current_balance"),
  );
  assert.ok(
    !sql
      .prepare("PRAGMA table_info(transactions)")
      .all()
      .some((c) => c.name === "amount"),
  );
  sql.close();
});
test("monthly recurrence stays anchored to 31st and leap day", () => {
  assert.deepEqual(
    occurrences("2024-01-31", 1, "MONTH", "2024-01-01", "2024-04-30"),
    ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"],
  );
  assert.deepEqual(
    occurrences("2024-02-29", 1, "YEAR", "2024-01-01", "2028-12-31"),
    ["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"],
  );
});
test("loan principal conservation and exact final installment, with interest separated", () => {
  const p = 12345678,
    bps = 875,
    n = 48;
  const rows = amortization(p, bps, n, suggestedEMI(p, bps, n), "2026-01-31");
  assert.equal(
    rows.reduce((s, r) => s + r.principal_minor, 0),
    p,
  );
  assert.ok(
    rows.every(
      (r) =>
        Number.isInteger(r.amount_minor) &&
        r.amount_minor === r.interest_minor + r.principal_minor,
    ),
  );
  assert.equal(rows[1]!.due_date, "2026-02-28");
  assert.equal(rows[2]!.due_date, "2026-03-31");
  assert.throws(() => amortization(p, bps, n, 1, "2026-01-01"));
});
test("salary catch-up is idempotent; deleting a generated salary never regenerates it", async () => {
  const sql = testDatabase();
  const today = dateKey(),
    month = today.slice(0, 7);
  const id = await PlanningRepository.save("salary", {
    title: "My pay",
    account_id: "a",
    category_id: "salary",
    amount_minor: 10001,
    payday: 1,
    start_date: month + "-01",
    auto_post: 1,
    is_active: 1,
    remind_days: 0,
  });
  await reconcilePlans();
  await reconcilePlans();
  assert.equal(
    sql.prepare("SELECT COUNT(*) n FROM salary_occurrences").get()!.n,
    1,
  );
  const rows = await TransactionRepository.all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.amount_minor, 10001);
  await TransactionRepository.remove(rows[0]!.id);
  await reconcilePlans();
  assert.equal((await TransactionRepository.all()).length, 0);
  assert.equal(
    sql.prepare("SELECT COUNT(*) n FROM salary_occurrences").get()!.n,
    1,
  );
  sql.close();
});
test("manual salary posts once and recurring transfers preserve liquidity", async () => {
  const sql = testDatabase(),
    today = dateKey();
  const salary = await PlanningRepository.save("salary", {
    title: "Manual pay",
    account_id: "a",
    category_id: "salary",
    amount_minor: 12345,
    payday: new Date().getDate(),
    start_date: today,
    auto_post: 0,
    is_active: 1,
    remind_days: 0,
  });
  await postPlanned("SALARY", salary, today);
  await assert.rejects(() => postPlanned("SALARY", salary, today));
  await PlanningRepository.save("recurring", {
    title: "Move to wallet",
    type: "TRANSFER",
    amount_minor: 10000,
    account_id: "a",
    destination_account_id: "b",
    anchor_date: today,
    interval_count: 1,
    interval_unit: "MONTH",
    auto_post: 1,
    is_active: 1,
  });
  await reconcilePlans();
  await reconcilePlans();
  const accounts = await AccountRepository.all();
  assert.equal(
    accounts.reduce((n, a) => n + a.current_balance_minor, 0),
    10012345,
  );
  assert.equal(
    accounts.find((a) => a.id === "b")!.current_balance_minor,
    10000,
  );
  sql.close();
});
test("EMI and subscription payment guards roll back second debits; reversing restores unpaid state", async () => {
  const sql = testDatabase();
  const loan = await PlanningRepository.save("loans", {
    title: "My loan",
    account_id: "a",
    category_id: "food",
    principal_minor: 100000,
    annual_rate_bps: 0,
    tenure_months: 10,
    emi_minor: 10000,
    first_due_date: "2026-01-31",
    remind_days: 3,
    is_active: 1,
  });
  const emi = (await PlanningRepository.load()).emis[0]!;
  await PlanningRepository.payEMI(emi.id);
  await assert.rejects(() => PlanningRepository.payEMI(emi.id));
  assert.equal(
    (await AccountRepository.all()).find((a) => a.id === "a")!
      .current_balance_minor,
    9990000,
  );
  await assert.rejects(() =>
    PlanningRepository.save(
      "loans",
      {
        title: "Changed",
        account_id: "a",
        principal_minor: 10000,
        annual_rate_bps: 0,
        tenure_months: 1,
        emi_minor: 10000,
        first_due_date: "2026-01-31",
        remind_days: 3,
        is_active: 1,
      },
      loan,
    ),
  );
  const paid = (await PlanningRepository.load()).emis.find(
    (e) => e.id === emi.id,
  )!;
  await TransactionRepository.remove(paid.transaction_id!);
  assert.equal(
    (await PlanningRepository.load()).emis.find((e) => e.id === emi.id)!.status,
    "PENDING",
  );
  const sub = await PlanningRepository.save("subscriptions", {
    title: "My provider",
    amount_minor: 19900,
    anchor_date: "2026-01-31",
    interval_count: 1,
    interval_unit: "MONTH",
    account_id: "a",
    category_id: "food",
    remind_days: 1,
    is_active: 1,
  });
  await PlanningRepository.paySubscription(sub, "2026-01-31");
  await assert.rejects(() =>
    PlanningRepository.paySubscription(sub, "2026-01-31"),
  );
  assert.equal((await TransactionRepository.all()).length, 1);
  sql.close();
});
test("transaction edits and reversals recalculate both transfer accounts without cached totals", async () => {
  const sql = testDatabase();
  const id = await TransactionRepository.create({
    accountId: "a",
    destinationId: "b",
    type: "TRANSFER",
    amount: 10.01,
  });
  await TransactionRepository.edit(id, {
    accountId: "b",
    destinationId: "a",
    type: "TRANSFER",
    amount: 20.02,
  });
  const a = await AccountRepository.all();
  assert.equal(a.find((a) => a.id === "a")!.current_balance_minor, 10002002);
  assert.equal(a.find((a) => a.id === "b")!.current_balance_minor, -2002);
  await TransactionRepository.remove(id);
  assert.equal(
    (await AccountRepository.all()).find((a) => a.id === "a")!
      .current_balance_minor,
    10000000,
  );
  assert.equal((await TransactionRepository.all()).length, 0);
  sql.close();
});
test("goal reservations do not become expenses, and linked transfers undo atomically", async () => {
  const sql = testDatabase();
  const goal = await PlanningRepository.save("goals", {
    title: "Emergency",
    target_minor: 100000,
    deadline: null,
    color_hex: "#00A88A",
    is_active: 1,
  });
  await PlanningRepository.contribute(goal, "a", 10000, "Reserve");
  assert.equal((await TransactionRepository.all()).length, 0);
  await assert.rejects(() =>
    PlanningRepository.contribute(goal, "a", 10000000, "Too much"),
  );
  await PlanningRepository.contribute(goal, "a", -2000, "Release");
  await assert.rejects(() =>
    PlanningRepository.contribute(goal, "a", -9000, "Too much"),
  );
  await PlanningRepository.contribute(goal, "a", 10000, "Move", "b");
  const entries = await TransactionRepository.all();
  assert.equal(entries[0]!.type, "TRANSFER");
  await TransactionRepository.remove(entries[0]!.id);
  const data = await PlanningRepository.load();
  assert.equal(
    data.contributions.reduce((s, c) => s + c.amount_minor, 0),
    8000,
  );
  sql.close();
});
test("budget warnings are unique, expenses ignore transfers and employer receivables", async () => {
  const sql = testDatabase();
  const month = dateKey().slice(0, 7);
  await PlanningRepository.save("budgets", {
    category_id: "food",
    month,
    limit_minor: 10000,
    alert_percent: 80,
  });
  await TransactionRepository.create({
    accountId: "a",
    type: "EXPENSE",
    amount: 85,
    categoryId: "food",
  });
  await TransactionRepository.create({
    accountId: "a",
    type: "EXPENSE",
    amount: 50,
    categoryId: "food",
    reimbursable: true,
  });
  await TransactionRepository.create({
    accountId: "a",
    destinationId: "b",
    type: "TRANSFER",
    amount: 50,
  });
  await reconcilePlans();
  await reconcilePlans();
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM budget_alerts").get()!.n, 1);
  assert.equal(
    budgetSpent(await TransactionRepository.all(), month, "food"),
    8500,
  );
  assert.equal(
    monthTotals(await TransactionRepository.all(), month).expenses,
    8500,
  );
  sql.close();
});
test("authenticated snapshot restore is atomic and rejects fractional paise or malformed settings", async () => {
  const sql = testDatabase();
  await TransactionRepository.create({
    accountId: "a",
    type: "EXPENSE",
    amount: 2.03,
  });
  const conn = adapter(sql),
    snapshot = await readSnapshot(conn);
  await replaceSnapshot(conn, snapshot);
  assert.equal((await TransactionRepository.all())[0]!.amount_minor, 203);
  const bad = structuredClone(snapshot);
  bad.tables.transactions![0]!.amount_minor = 20.3;
  await assert.rejects(() => replaceSnapshot(conn, bad));
  assert.equal((await TransactionRepository.all())[0]!.amount_minor, 203);
  const config = structuredClone(snapshot);
  config.tables.app_settings = [{ key: "weekTargets", value: "[1]" }];
  await assert.rejects(() => replaceSnapshot(conn, config));
  assert.equal((await TransactionRepository.all()).length, 1);
  sql.close();
});
test("manual work logs reject overlaps and break corrections remain contained", async () => {
  const sql = testDatabase();
  const end = Date.now() - 3600000,
    start = end - 3600000;
  await ShiftRepository.addManual(
    start,
    end,
    60,
    "WFH",
    "Manual",
    defaultSettings,
  );
  await assert.rejects(() =>
    ShiftRepository.addManual(
      start,
      end,
      60,
      "WFH",
      "Overlap",
      defaultSettings,
    ),
  );
  const shift = (await ShiftRepository.all())[0]!;
  sql
    .prepare(
      "INSERT INTO shift_breaks(id,shift_id,break_start,break_end) VALUES(?,?,?,?)",
    )
    .run(
      "b",
      shift.id,
      new Date(start + 600000).toISOString(),
      new Date(start + 1200000).toISOString(),
    );
  await assert.rejects(() => ShiftRepository.editBreak("b", start - 1, end));
  await ShiftRepository.editBreak("b", start + 600000, start + 1800000);
  assert.equal((await ShiftRepository.breaks())[0]!.duration_minutes, 20);
  sql.close();
});
