import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyTimeSeries } from "../src/domain/timeAnalytics";
import { Shift, Break } from "../src/domain/models";
const iso = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).toISOString();
const work: Shift = {
  id: "work",
  work_date: "2026-10-19",
  tracking_mode: "GROSS",
  shift_type: "OFFICE",
  target_minutes: 240,
  buffer_minutes: 0,
  first_swipe_in: iso(19, 22),
  last_swipe_out: iso(20, 2),
  status: "COMPLETED",
  notes: null,
  created_at: 0,
  cutoff_at: iso(20, 3),
};
test("daily analytics split midnight and keep simultaneous focus separate from work", () => {
  const focus: Shift = {
    ...work,
    id: "focus",
    shift_type: "CUSTOM",
    tracking_mode: "NET",
    first_swipe_in: iso(19, 23),
    last_swipe_out: iso(20, 1),
    cutoff_at: null,
  };
  const pauses: Break[] = [
    {
      id: "pause",
      shift_id: "focus",
      break_start: iso(19, 23, 45),
      break_end: iso(20, 0, 15),
      duration_minutes: 30,
    },
  ];
  const rows = dailyTimeSeries([work, focus], pauses, "2026-10-19", 2);
  assert.deepEqual(
    rows.map((r) => [r.work / 60000, r.focus / 60000]),
    [
      [120, 45],
      [120, 45],
    ],
  );
});
test("unclosed work is capped at reset while focus keeps counting", () => {
  const active: Shift = {
    ...work,
    status: "NEEDS_REVIEW",
    last_swipe_out: null,
  };
  const focus: Shift = {
    ...active,
    id: "focus",
    status: "ACTIVE",
    shift_type: "CUSTOM",
    cutoff_at: null,
  };
  const rows = dailyTimeSeries(
    [active, focus],
    [],
    "2026-10-20",
    1,
    Date.parse(iso(20, 5)),
  );
  assert.equal(rows[0]!.work / 60000, 180);
  assert.equal(rows[0]!.focus / 60000, 300);
});
