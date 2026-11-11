import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDatabase } from "./database";
import { db } from "../src/db/connection";
import { defaultSettings } from "../src/domain/models";
import { dateKey } from "../src/domain/shift";
import { AccountRepository } from "../src/repositories/AccountRepository";
import { HolidayRepository } from "../src/repositories/HolidayRepository";
import { PlanningRepository } from "../src/repositories/PlanningRepository";
import { SettingsRepository } from "../src/repositories/SettingsRepository";
import { csv } from "../src/services/crypto";
import { reconcilePlans } from "../src/services/recurrence";

const sip = (overrides: object = {}) => ({
  title: "Index SIP",
  account_id: "a",
  category_id: null,
  is_active: 1,
  amount_minor: 50000,
  anchor_date: dateKey(),
  interval_count: 1,
  interval_unit: "MONTH",
  remind_days: 0,
  auto_post: 1,
  payment_type: "TRANSFER",
  destination_account_id: "b",
  ...overrides,
});

test("every named navigation path has a route file", () => {
  // Read as text: the navigation module itself needs the native router runtime.
  const source = readFileSync("src/ui/navigation.ts", "utf8");
  const paths = new Set(
    [...source.matchAll(/: "(\/[a-z-]*)",/g)].map((m) => m[1]!),
  );
  assert.ok(paths.size > 40);
  for (const path of paths) {
    if (path === "/") continue;
    assert.ok(
      existsSync(`app${path}.tsx`) || existsSync(`app/(tabs)${path}.tsx`),
      `missing route for ${path}`,
    );
  }
});

test("an account receiving an active investment transfer cannot be archived", async () => {
  testDatabase();
  await PlanningRepository.save("subscriptions", sip());
  await assert.rejects(AccountRepository.archive("b"), /investment plans/);
});

test("a plan that can no longer post stays due instead of blocking reconciliation", async () => {
  testDatabase();
  const id = await PlanningRepository.save("subscriptions", sip());
  // Simulates data saved by an earlier version, where the destination could be archived.
  await db().runAsync("UPDATE accounts SET is_active=0 WHERE id='b'");
  await reconcilePlans();
  assert.equal(
    (
      await db().getAllAsync(
        "SELECT * FROM subscription_payments WHERE subscription_id=?",
        id,
      )
    ).length,
    0,
  );
  const due = await db().getFirstAsync<{ enabled: number }>(
    "SELECT enabled FROM reminders WHERE kind='SUBSCRIPTION' AND source_id=? AND occurrence_date=?",
    id,
    dateKey(),
  );
  assert.equal(due?.enabled, 1);
  // Repairing the plan lets the same occurrence post exactly once.
  await db().runAsync("UPDATE accounts SET is_active=1 WHERE id='b'");
  await reconcilePlans();
  await reconcilePlans();
  assert.equal(
    (
      await db().getAllAsync(
        "SELECT * FROM subscription_payments WHERE subscription_id=?",
        id,
      )
    ).length,
    1,
  );
});

test("recurring income and expenses never keep a transfer destination", async () => {
  testDatabase();
  const id = await PlanningRepository.save("recurring", {
    title: "Rent",
    account_id: "a",
    category_id: null,
    is_active: 1,
    type: "EXPENSE",
    amount_minor: 100,
    destination_account_id: "b",
    anchor_date: "2030-01-01",
    interval_count: 1,
    interval_unit: "MONTH",
    auto_post: 0,
  });
  const row = await db().getFirstAsync<{ destination_account_id: null }>(
    "SELECT destination_account_id FROM recurring_rules WHERE id=?",
    id,
  );
  assert.equal(row?.destination_account_id, null);
  await AccountRepository.archive("b");
});

test("holiday dates validate as local calendar dates in every timezone", async () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["Pacific/Auckland", "Etc/GMT+12", "Asia/Kolkata"]) {
      process.env.TZ = zone;
      testDatabase();
      await HolidayRepository.add("2026-01-15", "Founders day", false);
      await assert.rejects(HolidayRepository.add("2026-02-30", "Nope", false));
      await assert.rejects(HolidayRepository.mark("2026-13-01", "LEAVE"));
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("a damaged stored preference falls back to its default instead of failing to load", async () => {
  testDatabase();
  await db().runAsync(
    "INSERT INTO app_settings VALUES('buffer','999'),('currency','\"usd\"'),('cycleDay','15')",
  );
  const settings = await SettingsRepository.load();
  assert.equal(settings.buffer, defaultSettings.buffer);
  assert.equal(settings.currency, defaultSettings.currency);
  assert.equal(settings.cycleDay, 15);
  await assert.rejects(SettingsRepository.save("buffer", 999));
});

test("CSV export neutralises tab- and return-prefixed formulas", () => {
  assert.equal(csv([["\t=1+1", "\r@x", -5]]), `"'\t=1+1","'\r@x","-5"`);
});
