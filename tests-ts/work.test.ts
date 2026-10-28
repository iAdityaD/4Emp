import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { testDatabase } from "./database";
import { defaultSettings, Shift } from "../src/domain/models";
import { SettingsRepository } from "../src/repositories/SettingsRepository";
import { PlanningRepository } from "../src/repositories/PlanningRepository";
import { ShiftRepository } from "../src/repositories/ShiftRepository";
import { scheduledMinutes, shiftStartPlan } from "../src/domain/workSchedule";
import { cutoffWindow, dateKey, metrics, workDate } from "../src/domain/shift";
import { notificationPlan } from "../src/services/notificationPlan";

const at = (day: number, hour = 9, minute = 4) =>
  new Date(2026, 9, day, hour, minute).getTime();
const weekly = {
  ...defaultSettings,
  baseline: 540,
  useWeeklyTargets: true,
  weekTargets: [540, 540, 540, 540, 360, 0, 0],
};
const profile = {
  title: "WFH",
  target_minutes: 420,
  buffer_minutes: 0,
  tracking_mode: "NET",
  shift_type: "WFH",
  cutoff_minute: 180,
  weekdays: 31,
};
function sample(start: number, target = 240, cutoff = 180): Shift {
  return {
    id: "night",
    work_date: workDate(start, cutoff),
    tracking_mode: "GROSS",
    shift_type: "OFFICE",
    target_minutes: target,
    buffer_minutes: 0,
    first_swipe_in: new Date(start).toISOString(),
    last_swipe_out: null,
    status: "ACTIVE",
    notes: null,
    created_at: start,
    cutoff_at: new Date(cutoffWindow(start, cutoff).end).toISOString(),
  };
}

test("applying a profile preserves a custom week and active shift snapshots", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: at(19) });
  const sql = testDatabase();
  await SettingsRepository.update(weekly);
  await ShiftRepository.start("OFFICE", 0, await SettingsRepository.load());
  const before = (await ShiftRepository.all())[0]!;
  const id = await PlanningRepository.save("profiles", profile);
  await SettingsRepository.applyWorkProfile(id);
  const settings = await SettingsRepository.load();
  assert.equal(settings.baseline, 420);
  assert.equal(settings.defaultShiftType, "WFH");
  assert.equal(settings.mode, "NET");
  assert.equal(settings.cutoff, 180);
  assert.deepEqual(settings.weekTargets, weekly.weekTargets);
  assert.equal(settings.useWeeklyTargets, true);
  assert.equal(settings.weekends, 96);
  assert.equal(scheduledMinutes(settings, "2026-10-23"), 360);
  assert.deepEqual((await ShiftRepository.all())[0], before);
  sql.close();
});

test("uniform profiles update workdays without erasing saved weekday targets", async () => {
  const sql = testDatabase();
  const saved = [480, 480, 480, 480, 360, 0, 0];
  await SettingsRepository.update({
    weekTargets: saved,
    useWeeklyTargets: false,
  });
  const id = await PlanningRepository.save("profiles", {
    ...profile,
    weekdays: 15,
  });
  await SettingsRepository.applyWorkProfile(id);
  const settings = await SettingsRepository.load();
  assert.equal(settings.weekends, 112);
  assert.equal(settings.useWeeklyTargets, false);
  assert.deepEqual(settings.weekTargets, saved);
  assert.equal(scheduledMinutes(settings, "2026-10-23"), 0);
  sql.close();
});

test("profile application rolls back every setting if one write fails", async () => {
  const sql = testDatabase();
  const id = await PlanningRepository.save("profiles", profile);
  const before = await SettingsRepository.load();
  sql.exec(
    "CREATE TRIGGER reject_profile_mode BEFORE INSERT ON app_settings WHEN NEW.key='mode' BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END",
  );
  await assert.rejects(
    () => SettingsRepository.applyWorkProfile(id),
    /simulated storage failure/,
  );
  assert.deepEqual(await SettingsRepository.load(), before);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM app_settings").get()!.n, 0);
  sql.close();
});

test("weekday targets and days-off edits stay consistent", async () => {
  const sql = testDatabase();
  await SettingsRepository.update(weekly);
  await SettingsRepository.save(
    "weekTargets",
    [540, 540, 540, 540, 360, 180, 0],
  );
  assert.equal((await SettingsRepository.load()).weekends, 64);
  await SettingsRepository.save("weekends", 96);
  const settings = await SettingsRepository.load();
  assert.deepEqual(settings.weekTargets, [540, 540, 540, 540, 360, 0, 0]);
  sql.close();
});

test("rest days stay at zero until a confirmed or custom override", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: at(24) });
  const settings = { ...weekly, reminders: [] };
  const plan = shiftStartPlan(Date.now(), settings, "OFFICE", 0);
  assert.equal(plan.target, 0);
  assert.equal(plan.requiresRestConfirmation, true);
  assert.equal(plan.overrideTarget, 540);
  const sql = testDatabase();
  await assert.rejects(
    () => ShiftRepository.start("OFFICE", 0, settings),
    /rest day/,
  );
  assert.equal((await ShiftRepository.all()).length, 0);
  await ShiftRepository.start("OFFICE", 0, settings, { allowRestDay: true });
  assert.equal((await ShiftRepository.all())[0]!.target_minutes, 540);
  assert.deepEqual(settings.weekTargets, weekly.weekTargets);
  sql.close();
});

test("custom and stopwatch shifts remain available on all seven days", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: at(24) });
  const sql = testDatabase();
  await ShiftRepository.start("CUSTOM", 180, weekly);
  assert.equal((await ShiftRepository.all())[0]!.target_minutes, 180);
  await ShiftRepository.complete((await ShiftRepository.all())[0]!);
  await ShiftRepository.start("OPEN_ENDED", 0, weekly);
  assert.equal(
    (await ShiftRepository.all()).find((s) => s.status === "ACTIVE")!
      .target_minutes,
    0,
  );
  sql.close();
});

test("late starts need acknowledgement without silently rolling the cutoff forward", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: at(19, 20) });
  const sql = testDatabase();
  const plan = shiftStartPlan(Date.now(), weekly, "OFFICE", 0);
  assert.equal(plan.exceedsCutoff, true);
  await assert.rejects(
    () => ShiftRepository.start("OFFICE", 0, weekly),
    /after day reset/,
  );
  assert.equal((await ShiftRepository.all()).length, 0);
  await ShiftRepository.start("OFFICE", 0, weekly, { allowLateStart: true });
  const row = (await ShiftRepository.all())[0]!;
  assert.equal(row.cutoff_at, new Date(at(19, 23, 59)).toISOString());
  assert.equal(metrics(row, [], at(20, 1)).review, true);
  sql.close();
});

test("overnight targets use the company workday rather than the phone calendar day", () => {
  const settings = { ...weekly, cutoff: 180 };
  const plan = shiftStartPlan(at(24, 1), settings, "OFFICE", 0);
  assert.equal(plan.day, "2026-10-23");
  assert.equal(plan.restDay, false);
  assert.equal(plan.target, 360);
  assert.equal(plan.cutoff, at(24, 3, 0));
});

test("date corrections move the calendar date and retain the shift's saved reset time", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: at(28) });
  const sql = testDatabase();
  await ShiftRepository.addManual(
    at(20, 21, 0),
    at(21, 2, 0),
    300,
    "OFFICE",
    "",
    { ...defaultSettings, cutoff: 180 },
  );
  const original = (await ShiftRepository.all())[0]!;
  await SettingsRepository.save("cutoff", 1439);
  await ShiftRepository.edit(
    original,
    at(19, 21, 0),
    at(20, 2, 0),
    "corrected date",
  );
  const corrected = (await ShiftRepository.all())[0]!;
  assert.equal(corrected.work_date, "2026-10-19");
  assert.equal(corrected.cutoff_at, new Date(at(20, 3, 0)).toISOString());
  assert.equal(corrected.status, "COMPLETED");
  sql.close();
});

test("moving an unclosed shift into an expired workday immediately requires review", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: at(21) });
  const sql = testDatabase();
  await ShiftRepository.start("OFFICE", 0, { ...defaultSettings, weekends: 0 });
  const original = (await ShiftRepository.all())[0]!;
  await ShiftRepository.edit(original, at(20), null, "");
  const corrected = (await ShiftRepository.all())[0]!;
  assert.equal(corrected.work_date, "2026-10-20");
  assert.equal(corrected.status, "NEEDS_REVIEW");
  assert.equal(corrected.cutoff_at, new Date(at(20, 23, 59)).toISOString());
  sql.close();
});

test("a stale native reset alarm cannot lock a shift whose corrected cutoff is still future", () => {
  const sql = testDatabase();
  const now = Date.now();
  const row = sample(now - 60000, 60, 1439);
  const future = new Date(now + 3600000).toISOString();
  sql
    .prepare(
      "INSERT INTO work_shifts(id,work_date,tracking_mode,shift_type,target_minutes,buffer_minutes,first_swipe_in,status,created_at,cutoff_at) VALUES(?,?,?,?,?,?,?,'ACTIVE',?,?)",
    )
    .run(
      row.id,
      row.work_date,
      row.tracking_mode,
      row.shift_type,
      60,
      0,
      row.first_swipe_in,
      now,
      future,
    );
  const source = readFileSync(
    new URL("../plugins/withEmployeeNative.js", import.meta.url),
    "utf8",
  );
  const where = source.match(
    /d\.update\("work_shifts",values,"([^"]+)",new String\[\]\{id\}\)/,
  )?.[1];
  assert.ok(where);
  const lock = () =>
    sql
      .prepare("UPDATE work_shifts SET status='NEEDS_REVIEW' WHERE " + where)
      .run(row.id);
  lock();
  assert.equal(
    sql.prepare("SELECT status FROM work_shifts").get()!.status,
    "ACTIVE",
  );
  sql
    .prepare("UPDATE work_shifts SET cutoff_at=?")
    .run(new Date(now - 1000).toISOString());
  lock();
  assert.equal(
    sql.prepare("SELECT status FROM work_shifts").get()!.status,
    "NEEDS_REVIEW",
  );
  sql.close();
});

test("WFH completion alerts use work wording and existing alert preferences", () => {
  const start = at(19);
  const row = { ...sample(start, 420, 1439), shift_type: "WFH" as const };
  const settings = {
    ...defaultSettings,
    reminders: [],
    shiftWarningMinutes: 0,
    overtimeMinutes: 0,
  };
  const plan = notificationPlan([row], [], settings, [], [], start);
  assert.equal(
    plan.find((a) => a.id.endsWith("-target"))!.title,
    "Work target reached",
  );
  assert.ok(!plan.some((a) => a.title.includes("swipe")));
  assert.ok(
    !plan.some((a) => a.id.endsWith("-warning") || a.id.endsWith("-overtime")),
  );
  assert.deepEqual(
    notificationPlan(
      [row],
      [],
      { ...settings, workNotifications: false },
      [],
      [],
      start,
    ),
    [],
  );
  assert.deepEqual(
    notificationPlan(
      [row],
      [],
      settings,
      [{ work_date: row.work_date, kind: "LEAVE", note: "" }],
      [],
      start,
    ),
    [],
  );
});

test("overnight alerts and reminders respect the owning workday's leave and holidays", () => {
  const start = at(19, 20, 0);
  const row = sample(start, 300, 180);
  const settings = {
    ...defaultSettings,
    cutoff: 180,
    reminders: [
      {
        id: "night-check",
        title: "Timesheet",
        message: "",
        minute: 60,
        days: 1,
        enabled: true,
      },
    ],
  };
  const tomorrowHoliday = [
    {
      id: "holiday",
      holiday_date: "2026-10-20",
      title: "Holiday",
      is_optional: 0,
    },
  ];
  const plan = notificationPlan(
    [row],
    [],
    settings,
    [],
    tomorrowHoliday,
    start,
  );
  assert.ok(plan.some((a) => a.id.endsWith("-target")));
  assert.ok(plan.some((a) => a.id === "reminder-night-check-2026-10-20"));
  const muted = notificationPlan(
    [row],
    [],
    settings,
    [{ work_date: row.work_date, kind: "LEAVE", note: "" }],
    [],
    start,
  );
  assert.ok(
    !muted.some(
      (a) =>
        a.id.startsWith("shift-") ||
        a.id.startsWith("cutoff-") ||
        a.id === "reminder-night-check-2026-10-20",
    ),
  );
});

test("work reminders skip zero-hour days unless the employee explicitly works that date", () => {
  const now = at(23, 8, 0);
  const settings = {
    ...weekly,
    weekTargets: [540, 540, 540, 540, 0, 0, 0],
    reminders: [
      {
        id: "lunch",
        title: "Lunch",
        message: "",
        minute: 780,
        days: 127,
        enabled: true,
      },
    ],
  };
  const id = "reminder-lunch-" + dateKey(now);
  assert.ok(
    !notificationPlan([], [], settings, [], [], now).some((a) => a.id === id),
  );
  assert.ok(
    notificationPlan(
      [],
      [],
      settings,
      [{ work_date: dateKey(now), kind: "WORKED", note: "" }],
      [],
      now,
    ).some((a) => a.id === id),
  );
});
