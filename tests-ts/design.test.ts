import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hexToHSV,
  hsvToHex,
  parseDuration,
  parseClockValue,
} from "../src/features/design/color";
import { balanceSeries } from "../src/features/design/metrics";
import type { Transaction } from "../src/domain/models";
import { defaultSettings } from "../src/domain/models";
import {
  contrast,
  DEFAULT_ACCENT,
  palette,
} from "../src/features/design/theme";
test("duration and clock inputs convert to canonical minutes and reject invalid values", () => {
  assert.equal(parseDuration("6", "30"), 390);
  assert.equal(parseClockValue("09:04"), 544);
  assert.equal(parseDuration("24", "00"), 1440);
  for (const [h, m] of [
    ["2", "60"],
    ["24", "01"],
    ["-1", "00"],
  ])
    assert.throws(() => parseDuration(h!, m!));
  assert.throws(() => parseClockValue("24:00"));
});
test("visual color picker preserves selected colors through HSV conversion", () => {
  for (const hex of [
    "#000000",
    "#FFFFFF",
    "#3B82F6",
    "#00A88A",
    "#FF0000",
    "#7B34D2",
  ]) {
    const { h, s, v } = hexToHSV(hex);
    assert.equal(hsvToHex(h, s, v), hex);
  }
});
test("balance chart reconstructs day-end liquidity while excluding transfers", () => {
  const entries = [
    {
      type: "INCOME",
      amount_minor: 10000,
      transaction_date: "2026-10-27T12:00:00Z",
    },
    {
      type: "EXPENSE",
      amount_minor: 1500,
      transaction_date: "2026-10-28T12:00:00Z",
    },
    {
      type: "TRANSFER",
      amount_minor: 5000,
      transaction_date: "2026-10-28T12:00:00Z",
    },
  ] as Transaction[];
  assert.deepEqual(
    balanceSeries(entries, 18500, 3, new Date("2026-10-28T18:00:00Z")).map(
      (p) => p.value,
    ),
    [10000, 20000, 18500],
  );
});

test("theme text and status colours meet WCAG AA on every surface in both modes", () => {
  assert.equal(defaultSettings.accent, DEFAULT_ACCENT);
  for (const dark of [true, false]) {
    const t = palette(dark, DEFAULT_ACCENT);
    for (const surface of [t.bg, t.card, t.inset]) {
      for (const ink of [
        t.text,
        t.muted,
        t.danger,
        t.success,
        t.cyan,
        t.orange,
        t.purple,
        t.accentInk,
      ])
        assert.ok(
          contrast(ink, surface) >= 4.5,
          `${ink} on ${surface} (${dark ? "dark" : "light"})`,
        );
    }
    // Secondary fills carry primary text.
    assert.ok(contrast(t.text, t.line) >= 4.5);
  }
});

test("any accent a user can pick stays readable as text and as a fill", () => {
  for (const accent of [
    "#000000",
    "#FFFFFF",
    "#FFFF00",
    "#00A88A",
    "#3B82F6",
    "#F7505E",
    "#7B34D2",
    "#808080",
  ])
    for (const dark of [true, false]) {
      const t = palette(dark, accent);
      assert.equal(t.accent, accent);
      assert.ok(contrast(t.onAccent, accent) >= 4.5, `on ${accent}`);
      assert.ok(contrast(t.accentInk, t.card) >= 4.5, `ink ${accent}`);
      assert.ok(contrast(t.accentInk, t.bg) >= 4.5, `ink ${accent} on bg`);
    }
});
