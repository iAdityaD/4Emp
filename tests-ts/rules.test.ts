import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database";
import { db } from "../src/db/connection";
import {
  Break,
  Category,
  defaultSettings,
  Shift,
  Transaction,
} from "../src/domain/models";
import { settingsSchema } from "../src/domain/settingsValidation";
import { dateKey } from "../src/domain/shift";
import {
  focusByLabel,
  focusShare,
  UNLABELLED_FOCUS,
} from "../src/domain/timeAnalytics";
import {
  editWindow,
  editWindowAdjective,
  editWindowText,
} from "../src/domain/transactionPolicy";
import {
  categoryChanges,
  frequentEntries,
  hourlyRate,
  lastEntry,
  subscriptionBurn,
  upcomingRenewals,
  workTime,
} from "../src/features/planning/insights";
import type { Subscription } from "../src/features/planning/models";
import { ruleGroups, rules, ruleText } from "../src/features/rules/registry";
import { PlanningRepository } from "../src/repositories/PlanningRepository";
import { SettingsRepository } from "../src/repositories/SettingsRepository";
import { ShiftRepository } from "../src/repositories/ShiftRepository";
import { TransactionRepository } from "../src/repositories/TransactionRepository";
import { reconcilePlans } from "../src/services/recurrence";

const HOUR = 3600000;

test("every registered rule is a validated setting of the declared type", () => {
  const shape = settingsSchema.shape as Record<string, unknown>;
  const groups = new Set(ruleGroups.map((g) => g.id));
  assert.equal(new Set(rules.map((r) => r.key)).size, rules.length);
  for (const rule of rules) {
    assert.ok(rule.key in shape, `${rule.key} has no schema`);
    assert.ok(groups.has(rule.group), `${rule.key} has no group`);
    assert.equal(
      typeof defaultSettings[rule.key],
      rule.type === "toggle" ? "boolean" : "number",
      rule.key,
    );
    assert.ok(rule.description.length > 10);
  }
  for (const group of ruleGroups)
    assert.ok(
      rules.some((r) => r.group === group.id),
      group.id,
    );
  const byKey = (key: string) => rules.find((r) => r.key === key)!;
  assert.equal(ruleText(byKey("editWindowHours"), 1), "1 hour");
  assert.equal(ruleText(byKey("editWindowHours"), 48), "48 hours");
  assert.equal(ruleText(byKey("autoPostCatchUpDays"), 0), "No limit");
  assert.equal(ruleText(byKey("editLock"), false), "Off");
});

test("the edit window follows the user's rule and can be switched off", async () => {
  testDatabase();
  assert.equal(editWindow(defaultSettings), 24 * HOUR);
  assert.equal(editWindowText(), "24 hours");
  assert.equal(editWindowAdjective(72 * HOUR), "72-hour");
  const old = () =>
    TransactionRepository.create({
      accountId: "a",
      type: "EXPENSE",
      amount: 10,
      date: new Date(Date.now() - 30 * HOUR).toISOString(),
    });
  await assert.rejects(TransactionRepository.remove(await old()), /24 hours/);
  await SettingsRepository.save("editWindowHours", 48);
  const second = await old();
  await TransactionRepository.edit(second, {
    accountId: "a",
    type: "EXPENSE",
    amount: 12,
    date: new Date(Date.now() - 30 * HOUR).toISOString(),
  });
  await TransactionRepository.remove(second);
  await SettingsRepository.save("editWindowHours", 1);
  await assert.rejects(TransactionRepository.remove(await old()), /1 hour /);
  await SettingsRepository.save("editLock", false);
  await TransactionRepository.remove(await old());
  await assert.rejects(SettingsRepository.save("editWindowHours", 0));
});

test("automatic posting only back-fills as far as the catch-up rule allows", async () => {
  const run = async (catchUpDays: number) => {
    testDatabase();
    const anchor = new Date();
    anchor.setDate(anchor.getDate() - 100);
    const id = await PlanningRepository.save("subscriptions", {
      title: "Music",
      account_id: "a",
      category_id: null,
      is_active: 1,
      amount_minor: 9900,
      anchor_date: dateKey(anchor),
      interval_count: 30,
      interval_unit: "DAY",
      remind_days: 0,
      auto_post: 1,
    });
    await reconcilePlans(Date.now(), 540, 1, catchUpDays);
    await reconcilePlans(Date.now(), 540, 1, catchUpDays);
    const posted = await db().getAllAsync(
      "SELECT * FROM subscription_payments WHERE subscription_id=?",
      id,
    );
    const overdue = await db().getAllAsync(
      "SELECT * FROM reminders WHERE source_id=? AND enabled=1 AND occurrence_date<?",
      id,
      dateKey(),
    );
    return [posted.length, overdue.length];
  };
  // Occurrences fall 100, 70, 40 and 10 days ago.
  assert.deepEqual(await run(0), [4, 0]);
  assert.deepEqual(await run(35), [1, 3]);
  assert.deepEqual(await run(45), [2, 2]);
});

test("focus timers save their label and honour the required-label rule", async () => {
  testDatabase();
  await ShiftRepository.start("CUSTOM", 25, defaultSettings, {
    label: "  Quarterly report ",
  });
  const [focus] = await ShiftRepository.all();
  assert.equal(focus!.notes, "Quarterly report");
  await ShiftRepository.complete(focus!);
  const strict = { ...defaultSettings, focusLabelRequired: true, weekends: 0 };
  await assert.rejects(
    ShiftRepository.start("CUSTOM", 25, strict),
    /focusing on/,
  );
  await assert.rejects(
    ShiftRepository.start("CUSTOM", 25, strict, { label: "x".repeat(81) }),
    /80 characters/,
  );
  // Work sessions never need, or keep, a focus label.
  await ShiftRepository.start("OFFICE", 0, strict, {
    label: "ignored",
    allowLateStart: true,
    allowRestDay: true,
  });
  const work = (await ShiftRepository.all()).find(
    (s) => s.shift_type === "OFFICE",
  );
  assert.equal(work!.notes, null);
});

test("focus share counts only focus inside work hours, net of pauses, and totals by label", () => {
  const at = (h: number, m = 0) => new Date(2026, 5, 10, h, m).toISOString();
  const session = (
    id: string,
    type: Shift["shift_type"],
    from: string,
    to: string,
    notes: string | null = null,
  ): Shift => ({
    id,
    work_date: "2026-06-10",
    tracking_mode: type === "OFFICE" ? "GROSS" : "NET",
    shift_type: type,
    target_minutes: 60,
    buffer_minutes: 0,
    first_swipe_in: from,
    last_swipe_out: to,
    status: "COMPLETED",
    notes,
    created_at: 0,
    cutoff_at: null,
  });
  const shifts = [
    session("w", "OFFICE", at(9), at(17)),
    session("f1", "CUSTOM", at(10), at(11), "Report"),
    session("f2", "CUSTOM", at(16, 30), at(17, 30), " Report "),
    session("f3", "CUSTOM", at(19), at(19, 30)),
  ];
  const breaks: Break[] = [
    {
      id: "b",
      shift_id: "f1",
      break_start: at(10, 15),
      break_end: at(10, 30),
      duration_minutes: 15,
    },
  ];
  const now = Date.parse(at(23));
  const share = focusShare(shifts, breaks, "2026-06-10", now);
  assert.equal(share.work, 8 * HOUR);
  // 45 focused minutes in the morning plus the 30 that overlap the end of work.
  assert.equal(share.focusInWork, 75 * 60000);
  assert.equal(share.share, 75 / 480);
  assert.equal(focusShare(shifts, breaks, "2026-06-11", now).share, 0);
  assert.deepEqual(focusByLabel(shifts, breaks, "2026-06-08", 7, now), [
    { label: "Report", ms: 105 * 60000 },
    { label: UNLABELLED_FOCUS, ms: 30 * 60000 },
  ]);
});

const entry = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  account_id: "a",
  destination_account_id: null,
  type: "EXPENSE",
  amount_minor: 12000,
  amount: 120,
  category_id: "food",
  transaction_date: new Date().toISOString(),
  note: "Lunch",
  is_reimbursable: 0,
  reimbursement_status: "NOT_APPLICABLE",
  is_split: 0,
  split_group_id: null,
  split_total_amount: null,
  split_my_share: null,
  split_notes: null,
  created_at: 0,
  ledger_kind: "PERSONAL",
  linked_transaction_id: null,
  tags: "[]",
  ...overrides,
});
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString();

test("quick entries come from the user's own repeated, hand-typed entries", () => {
  const rows = [
    entry({ transaction_date: daysAgo(1) }),
    entry({ transaction_date: daysAgo(3), note: " lunch " }),
    entry({ transaction_date: daysAgo(5) }),
    entry({ amount_minor: 4000, note: "Tea", transaction_date: daysAgo(2) }),
    entry({ amount_minor: 4000, note: "Tea", transaction_date: daysAgo(4) }),
    entry({ amount_minor: 99900, note: "Once", transaction_date: daysAgo(0) }),
    // Not hand-typed or outside the look-back period: never suggested.
    entry({ amount_minor: 50000, ledger_kind: "COMMITMENT", note: "EMI" }),
    entry({ amount_minor: 50000, ledger_kind: "COMMITMENT", note: "EMI" }),
    entry({ amount_minor: 7000, note: "Old", transaction_date: daysAgo(200) }),
    entry({ amount_minor: 7000, note: "Old", transaction_date: daysAgo(201) }),
    entry({ type: "INCOME", amount_minor: 100, note: "Tip" }),
  ];
  const picks = frequentEntries(rows, "EXPENSE", 4);
  assert.deepEqual(
    picks.map((p) => [p.note, p.amount_minor, p.count]),
    [
      ["Lunch", 12000, 3],
      ["Tea", 4000, 2],
    ],
  );
  assert.equal(frequentEntries(rows, "EXPENSE", 1).length, 1);
  assert.deepEqual(frequentEntries(rows, "EXPENSE", 0), []);
  assert.equal(lastEntry(rows, "EXPENSE")!.note, "Once");
  assert.equal(lastEntry(rows, "INCOME")!.note, "Tip");
  assert.equal(lastEntry(rows, "TRANSFER"), null);
});

test("spending changes respect the user's threshold and flag new categories", () => {
  const cat = (id: string): Category => ({
    id,
    name: id,
    icon_name: "ellipse",
    color_hex: "#000000",
    kind: "EXPENSE",
    is_active: 1,
    is_system: 0,
  });
  const on = (date: string, category_id: string, amount_minor: number) =>
    entry({
      category_id,
      amount_minor,
      transaction_date: new Date(date + "T12:00:00").toISOString(),
    });
  const rows = [
    on("2026-05-10", "food", 10000),
    on("2026-06-10", "food", 13000),
    on("2026-05-10", "fuel", 10000),
    on("2026-06-10", "fuel", 10500),
    on("2026-05-10", "rent", 20000),
    on("2026-06-10", "rent", 10000),
    on("2026-06-10", "gifts", 5000),
  ];
  const cats = ["food", "fuel", "rent", "gifts"].map(cat);
  assert.deepEqual(
    categoryChanges(rows, cats, "2026-06", 20).map((c) => [c.id, c.percent]),
    [
      ["rent", -50],
      ["gifts", null],
      ["food", 30],
    ],
  );
  assert.deepEqual(
    categoryChanges(rows, cats, "2026-06", 5).map((c) => c.id),
    ["rent", "gifts", "food", "fuel"],
  );
  assert.equal(categoryChanges(rows, cats, "2026-06", 60).length, 1);
});

test("subscription burn, renewals and work-time cost follow the user's rules", () => {
  const sub = (overrides: Partial<Subscription>): Subscription => ({
    id: "s",
    title: "Music",
    amount_minor: 12000,
    anchor_date: "2026-01-05",
    interval_count: 1,
    interval_unit: "MONTH",
    account_id: "a",
    category_id: null,
    remind_days: 0,
    is_active: 1,
    ...overrides,
  });
  const subs = [
    sub({}),
    sub({
      id: "y",
      title: "Cloud",
      amount_minor: 120000,
      interval_unit: "YEAR",
    }),
    sub({ id: "t", title: "SIP", payment_type: "TRANSFER" }),
    sub({ id: "off", is_active: 0 }),
    sub({ id: "ended", end_date: "2026-02-01" }),
  ];
  // 120.00 monthly + 1,200.00 yearly spread over 12 months; transfers are not spending.
  assert.equal(subscriptionBurn(subs, "2026-06-01"), 22000);
  const now = new Date(2026, 5, 1, 12).getTime();
  const due = upcomingRenewals(
    subs,
    [{ subscription_id: "t", occurrence_date: "2026-06-05" }],
    40,
    now,
  );
  assert.deepEqual(
    due.map((d) => [d.id, d.date]),
    [
      ["s", "2026-06-05"],
      ["s", "2026-07-05"],
      ["t", "2026-07-05"],
    ],
  );
  assert.equal(upcomingRenewals(subs, [], 3, now).length, 0);
  // 40 scheduled hours a week is about 173.9 hours a month.
  const settings = { ...defaultSettings, baseline: 480, weekends: 96 };
  const rate = hourlyRate(
    [
      {
        id: "r",
        title: "Pay",
        amount_minor: 8696400,
        payday: 1,
        account_id: "a",
        category_id: null,
        start_date: "2026-01-01",
        auto_post: 1,
        is_active: 1,
        remind_days: 0,
      },
    ],
    settings,
    now,
  );
  assert.equal(rate, 50000);
  assert.equal(workTime(100000, rate), "2h");
  assert.equal(workTime(25000, rate), "30m");
  assert.equal(workTime(175000, rate), "3h 30m");
  assert.equal(workTime(1000, 0), null);
  assert.equal(hourlyRate([], settings, now), 0);
  assert.equal(hourlyRate([], { ...settings, weekends: 127 }, now), 0);
});
