import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database";
import { ShiftRepository } from "../src/repositories/ShiftRepository";
import { TransactionRepository } from "../src/repositories/TransactionRepository";
import { PlanningRepository } from "../src/repositories/PlanningRepository";
import { LendingRepository } from "../src/repositories/LendingRepository";
import { defaultSettings } from "../src/domain/models";
import { metrics } from "../src/domain/shift";
import { reconcilePlans } from "../src/services/recurrence";
import { notificationPlan } from "../src/services/notificationPlan";
import { goalProgress } from "../src/features/planning/progress";
import {
  budgetSpent,
  monthTotals,
} from "../src/features/planning/calculations";
import { AccountRepository } from "../src/repositories/AccountRepository";
import { transactionExpired } from "../src/domain/transactionPolicy";
import { readSnapshot, replaceSnapshot } from "../src/services/snapshot";
const now = new Date(2026, 9, 19, 12).getTime();
const subscription = {
  title: "Membership",
  amount_minor: 20000,
  anchor_date: "2026-08-31",
  end_date: "2026-10-31",
  interval_count: 1,
  interval_unit: "MONTH",
  account_id: "a",
  category_id: "food",
  remind_days: 1,
  is_active: 1,
  auto_post: 1,
};
test("missed swipe starts at the entered time and rejects future or overlapping starts", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  await ShiftRepository.start("OFFICE", 0, defaultSettings, {
    startedAt: now - 3 * 3600000,
  });
  let s = (await ShiftRepository.all())[0]!;
  assert.equal(metrics(s, [], now).gross, 3 * 3600000);
  assert.equal(s.first_swipe_in, new Date(now - 3 * 3600000).toISOString());
  await ShiftRepository.complete(s, now - 3600000);
  await assert.rejects(
    () =>
      ShiftRepository.start("OFFICE", 0, defaultSettings, {
        startedAt: now + 1000,
      }),
    /past/,
  );
  await assert.rejects(
    () =>
      ShiftRepository.start("OFFICE", 0, defaultSettings, {
        startedAt: now - 2 * 3600000,
      }),
    /overlap/,
  );
  sql.close();
});
test("focus is break-aware, has no work buffer or reset, and runs on leave", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  await ShiftRepository.start("CUSTOM", 60, defaultSettings);
  const s = (await ShiftRepository.all())[0]!;
  assert.equal(s.buffer_minutes, 0);
  assert.equal(s.cutoff_at, null);
  assert.equal(s.tracking_mode, "NET");
  assert.equal(metrics(s, [], now + 86400000).review, false);
  const plan = notificationPlan(
    [s],
    [],
    { ...defaultSettings, reminders: [] },
    [{ work_date: s.work_date, kind: "LEAVE", note: "" }],
    [],
    now,
  );
  assert.ok(plan.some((a) => a.title === "Focus complete"));
  assert.ok(
    !plan.some((a) => a.id.includes("overtime") || a.id.startsWith("cutoff")),
  );
  await ShiftRepository.edit(s, now - 1000, null, "");
  assert.equal((await ShiftRepository.all())[0]!.cutoff_at, null);
  sql.close();
});
test("subscriptions stop at the end date and auto-post each due date once", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date(2026, 10, 1, 12).getTime(),
  });
  const sql = testDatabase();
  const id = await PlanningRepository.save("subscriptions", subscription);
  await reconcilePlans();
  await reconcilePlans();
  const payments = (await PlanningRepository.load()).subscriptionPayments;
  assert.deepEqual(payments.map((p) => p.occurrence_date).sort(), [
    "2026-08-31",
    "2026-09-30",
    "2026-10-31",
  ]);
  assert.equal((await TransactionRepository.all()).length, 3);
  assert.equal(
    (await PlanningRepository.load()).dueReminders.filter(
      (r) => r.enabled && r.source_id === id,
    ).length,
    0,
  );
  sql.close();
});
test("SIP transfers preserve total balances and stay out of spending analytics", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  await PlanningRepository.save("subscriptions", {
    ...subscription,
    anchor_date: "2026-10-19",
    end_date: null,
    payment_type: "TRANSFER",
    destination_account_id: "b",
    category_id: null,
  });
  await reconcilePlans();
  const accounts = await AccountRepository.all();
  assert.equal(
    accounts.find((a) => a.id === "b")!.current_balance_minor,
    20000,
  );
  assert.equal(
    accounts.reduce((n, a) => n + a.current_balance_minor, 0),
    10000000,
  );
  assert.equal(
    monthTotals(await TransactionRepository.all(), "2026-10").expenses,
    0,
  );
  sql.close();
});
test("reversing a fresh automatic subscription never regenerates the debit", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  await PlanningRepository.save("subscriptions", {
    ...subscription,
    anchor_date: "2026-10-19",
    end_date: null,
  });
  await reconcilePlans();
  const entry = (await TransactionRepository.all())[0]!;
  await TransactionRepository.remove(entry.id);
  await reconcilePlans();
  assert.equal((await TransactionRepository.all()).length, 0);
  assert.equal(
    (await PlanningRepository.load()).subscriptionPayments.length,
    1,
  );
  sql.close();
});
test("lending supports partial repayment without inflating personal expenses or income", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  const id = await LendingRepository.save({
    title: "Alex",
    amount_minor: 50000,
    account_id: "a",
    lent_date: "2026-10-19",
    due_date: "2026-10-25",
    notes: "Lunch",
  });
  await LendingRepository.repay(id, 20000, "b", "2026-10-19");
  await assert.rejects(
    () => LendingRepository.repay(id, 40000, "a", "2026-10-19"),
    /outstanding/,
  );
  assert.equal(
    (await AccountRepository.all()).reduce(
      (n, a) => n + a.current_balance_minor,
      0,
    ),
    9970000,
  );
  const totals = monthTotals(await TransactionRepository.all(), "2026-10");
  assert.equal(totals.income, 0);
  assert.equal(totals.expenses, 0);
  const data = await PlanningRepository.load();
  await assert.rejects(
    () => TransactionRepository.remove(data.lending[0]!.transaction_id),
    /Lending/,
  );
  await LendingRepository.undoRepayment(data.lendingRepayments[0]!.id);
  await LendingRepository.repay(id, 50000, "a", "2026-10-19");
  await LendingRepository.remove(id);
  assert.equal(
    (await AccountRepository.all()).reduce(
      (n, a) => n + a.current_balance_minor,
      0,
    ),
    10000000,
  );
  sql.close();
});
test("goals can compare account balance and monthly savings without fake contributions", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  const id = await PlanningRepository.save("goals", {
    title: "Reserve",
    target_minor: 9000000,
    deadline: null,
    color_hex: "#00A88A",
    tracking_basis: "BALANCE",
    account_id: null,
  });
  let data = await PlanningRepository.load();
  assert.equal(
    goalProgress(data.goals[0]!, await AccountRepository.all(), [], []),
    10000000,
  );
  await assert.rejects(
    () => PlanningRepository.contribute(id, "a", 100, ""),
    /automatically/,
  );
  await TransactionRepository.create({
    accountId: "a",
    type: "INCOME",
    amount: 2000,
  });
  await TransactionRepository.create({
    accountId: "a",
    type: "EXPENSE",
    amount: 300,
  });
  const g = { ...data.goals[0]!, tracking_basis: "MONTHLY_SAVINGS" as const };
  assert.equal(
    goalProgress(
      g,
      await AccountRepository.all(),
      await TransactionRepository.all(),
      [],
    ),
    170000,
  );
  sql.close();
});
test("budget reset preserves ledger and counts only subsequent spending", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  const id = await PlanningRepository.save("budgets", {
    category_id: "food",
    month: "2026-10",
    limit_minor: 100000,
    alert_percent: 80,
  });
  await TransactionRepository.create({
    accountId: "a",
    type: "EXPENSE",
    amount: 100,
    categoryId: "food",
  });
  t.mock.timers.tick(1000);
  await PlanningRepository.resetBudget(id);
  t.mock.timers.tick(1000);
  await TransactionRepository.create({
    accountId: "a",
    type: "EXPENSE",
    amount: 50,
    categoryId: "food",
  });
  const b = (await PlanningRepository.load()).budgets[0]!;
  assert.equal(
    budgetSpent(
      await TransactionRepository.all(),
      "2026-10",
      "food",
      b.reset_at,
    ),
    5000,
  );
  assert.equal((await TransactionRepository.all()).length, 2);
  sql.close();
});
test("24-hour edit lock uses occurrence time including backdated entries and exact boundary", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  const id = await TransactionRepository.create({
    accountId: "a",
    type: "EXPENSE",
    amount: 100,
    date: new Date(now - 86400000 + 1).toISOString(),
  });
  assert.equal(
    transactionExpired(new Date(now - 86400000 + 1).toISOString()),
    false,
  );
  t.mock.timers.tick(1);
  await assert.rejects(
    () =>
      TransactionRepository.edit(id, {
        accountId: "a",
        type: "EXPENSE",
        amount: 2,
      }),
    /24 hours/,
  );
  await assert.rejects(() => TransactionRepository.remove(id), /24 hours/);
  assert.equal((await TransactionRepository.all())[0]!.amount_minor, 10000);
  sql.close();
});
test("deleting expense restores balance, income removes it, transfer reverses both sides", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  for (const type of ["EXPENSE", "INCOME", "TRANSFER"] as const) {
    const id = await TransactionRepository.create({
      accountId: "a",
      type,
      amount: 25.01,
      destinationId: type === "TRANSFER" ? "b" : undefined,
    });
    await TransactionRepository.remove(id);
    assert.equal(
      (await AccountRepository.all()).find((a) => a.id === "a")!
        .current_balance_minor,
      10000000,
    );
    assert.equal(
      (await AccountRepository.all()).find((a) => a.id === "b")!
        .current_balance_minor,
      0,
    );
  }
  assert.equal(
    sql
      .prepare(
        "SELECT count(*) n FROM transactions WHERE voided_at IS NOT NULL",
      )
      .get()!.n,
    3,
  );
  sql.close();
});
test("new lending and subscription data survive encrypted snapshot payload roundtrip", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const sql = testDatabase();
  await PlanningRepository.save("subscriptions", subscription);
  await LendingRepository.save({
    title: "A",
    amount_minor: 10000,
    account_id: "a",
    lent_date: "2026-10-19",
    due_date: null,
  });
  const snapshot = await readSnapshot(
    (await import("../src/db/connection")).db(),
  );
  await replaceSnapshot((await import("../src/db/connection")).db(), snapshot);
  assert.equal((await PlanningRepository.load()).lending.length, 1);
  assert.equal(
    (await PlanningRepository.load()).subscriptions[0]!.auto_post,
    1,
  );
  assert.equal(sql.prepare("PRAGMA foreign_key_check").all().length, 0);
  sql.close();
});
