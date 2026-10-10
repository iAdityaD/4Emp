import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metrics,
  cutoffWindow,
  workDate,
  safeArrival,
  shiftTarget,
} from "../src/domain/shift";
import { cycle, dueDate, runway, parseAmount } from "../src/domain/finance";
import { notificationPlan } from "../src/services/notificationPlan";
import { defaultSettings, Shift, Break } from "../src/domain/models";
import { encryptBackup, decryptBackup, csv } from "../src/services/crypto";
const start = new Date(2026, 9, 10, 9, 4).getTime();
const shift: Shift = {
  id: "s",
  work_date: "2026-10-10",
  tracking_mode: "GROSS",
  shift_type: "OFFICE",
  target_minutes: 540,
  buffer_minutes: 5,
  first_swipe_in: new Date(start).toISOString(),
  last_swipe_out: null,
  status: "ACTIVE",
  notes: null,
  created_at: start,
  cutoff_at: new Date(cutoffWindow(start, 1439).end).toISOString(),
};
const breaks: Break[] = [
  {
    id: "b",
    shift_id: "s",
    break_start: new Date(start + 3600000).toISOString(),
    break_end: new Date(start + 5400000).toISOString(),
    duration_minutes: 30,
  },
];
test("9:04 + 9h + buffer = 18:09; gross retains break", () => {
  const m = metrics(shift, breaks, start + 7200000);
  assert.equal(m.target, start + 545 * 60000);
  assert.equal(m.gross, 7200000);
  assert.equal(m.net, 5400000);
});
test("net target extends by finished and live breaks", () => {
  const net = { ...shift, tracking_mode: "NET" as const };
  assert.equal(
    metrics(net, breaks, start + 7200000).target,
    start + 575 * 60000,
  );
  const live = [{ ...breaks[0]!, break_end: null }];
  assert.equal(metrics(net, live, start + 7200000).pause, 3600000);
  assert.equal(metrics(net, live, start + 7200000).breakActive, true);
});
test("half day, custom and untethered stopwatch", () => {
  assert.equal(shiftTarget("HALF_DAY", 510, 0), 255);
  assert.equal(shiftTarget("CUSTOM", 510, 180), 180);
  assert.equal(shiftTarget("OPEN_ENDED", 510, 0), 0);
  assert.equal(
    metrics(
      {
        ...shift,
        shift_type: "OPEN_ENDED",
        target_minutes: 0,
        buffer_minutes: 0,
      },
      [],
      start + 3600000,
    ).productive,
    3600000,
  );
});
test("cutoff locks elapsed and requires review, early cutoff attributes previous work date", () => {
  const end = Date.parse(shift.cutoff_at!);
  assert.equal(metrics(shift, [], end + 7200000).gross, end - start);
  assert.equal(metrics(shift, [], end + 1).review, true);
  const early = new Date(2026, 9, 11, 2).getTime();
  assert.equal(workDate(early, 180), "2026-10-10");
  assert.equal(new Date(cutoffWindow(early, 180).end).getHours(), 3);
  assert.equal(
    safeArrival(start, 1439, 540, 5).latest,
    Date.parse(shift.cutoff_at!) - 545 * 60000,
  );
});
test("three native alert timestamps; no mandatory alarms in WFH/open-ended", () => {
  const settings = { ...defaultSettings, reminders: [] };
  const p = notificationPlan([shift], [], settings, [], [], start);
  assert.equal(
    p.find((x) => x.id.endsWith("-warning"))?.at,
    start + 530 * 60000,
  );
  assert.equal(
    p.find((x) => x.id.endsWith("-target"))?.at,
    start + 545 * 60000,
  );
  assert.equal(
    p.find((x) => x.id.endsWith("-overtime"))?.at,
    start + 605 * 60000,
  );
  assert.equal(
    notificationPlan(
      [{ ...shift, shift_type: "WFH" }],
      [],
      settings,
      [],
      [],
      start,
    ).length,
    0,
  );
  assert.equal(
    notificationPlan(
      [{ ...shift, shift_type: "OPEN_ENDED" }],
      [],
      settings,
      [],
      [],
      start,
    ).length,
    0,
  );
});
test("leave suppresses today, net active breaks defer target alerts", () => {
  const p = notificationPlan(
    [shift],
    [],
    { ...defaultSettings, reminders: [] },
    [{ work_date: "2026-10-10", kind: "LEAVE", note: "" }],
    [],
    start,
  );
  assert.equal(p.length, 0);
  const live = [{ ...breaks[0]!, break_end: null }];
  const net = notificationPlan(
    [{ ...shift, tracking_mode: "NET" }],
    live,
    { ...defaultSettings, reminders: [] },
    [],
    [],
    start + 7200000,
  );
  assert.ok(net.every((x) => x.id.startsWith("cutoff")));
});
test("due days snap; cycle uses calendar days; negative runway remains visible", () => {
  assert.equal(dueDate(2026, 1, 31).getDate(), 28);
  assert.equal(dueDate(2024, 1, 31).getDate(), 29);
  const c = cycle(new Date(2026, 9, 10), 1);
  assert.equal(c.days, 22);
  assert.equal(runway(100, 200, 10).daily, -10);
  assert.equal(parseAmount("100.25"), 100.25);
  assert.throws(() => parseAmount("1.234"));
  assert.throws(() => parseAmount("NaN"));
});
test("encrypted backup authenticates password and tampering; CSV avoids formula injection", async () => {
  const e = await encryptBackup(
    '{"private":true}',
    "test-passphrase",
    new Uint8Array(16).fill(3),
    new Uint8Array(12).fill(7),
  );
  assert.equal(await decryptBackup(e, "test-passphrase"), '{"private":true}');
  await assert.rejects(() => decryptBackup(e, "wrong-password"));
  await assert.rejects(() =>
    decryptBackup(
      {
        ...e,
        ciphertext:
          (e.ciphertext[0] === "0" ? "1" : "0") + e.ciphertext.slice(1),
      },
      "test-passphrase",
    ),
  );
  assert.match(csv([["=SUM(A1)", 123, 'a"b']]), /"'=SUM/);
});
