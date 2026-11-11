import type { Category, Settings, Transaction } from "../../domain/models";
import { dateKey, localDate } from "../../domain/shift";
import { scheduledMinutes } from "../../domain/workSchedule";
import { budgetSpent, occurrences } from "./calculations";
import type { IntervalUnit, SalaryRule, Subscription } from "./models";
/**
 * Pure helpers behind quick entry and Insights. Every threshold and count is
 * passed in from the user's rules; nothing here decides policy on its own.
 */
type EntryType = Transaction["type"];
export interface QuickEntry {
  type: EntryType;
  amount_minor: number;
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  note: string;
  /** How many matching entries were found in the look-back period. */
  count: number;
}
/** Entries typed by hand; plan postings, adjustments and claims are excluded. */
const manual = (t: Transaction, type: EntryType) =>
  t.type === type &&
  t.ledger_kind === "PERSONAL" &&
  !t.is_split &&
  !t.is_reimbursable;
const toQuick = (t: Transaction, count: number): QuickEntry => ({
  type: t.type,
  amount_minor: t.amount_minor,
  account_id: t.account_id,
  destination_account_id: t.destination_account_id,
  category_id: t.category_id,
  note: t.note ?? "",
  count,
});
/** The most recent hand-typed entry of a type, for "repeat last". */
export function lastEntry(transactions: Transaction[], type: EntryType) {
  const latest = transactions
    .filter((t) => manual(t, type))
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))[0];
  return latest ? toQuick(latest, 1) : null;
}
/**
 * The user's own repeated entries, most frequent first: the same amount,
 * account, category and note recorded at least twice in the look-back period.
 */
export function frequentEntries(
  transactions: Transaction[],
  type: EntryType,
  limit: number,
  now = Date.now(),
  lookBackDays = 90,
): QuickEntry[] {
  if (limit <= 0) return [];
  const since = new Date(now - lookBackDays * 86400000).toISOString();
  const groups = new Map<string, { latest: Transaction; count: number }>();
  for (const t of transactions) {
    if (!manual(t, type) || t.transaction_date < since) continue;
    const key = [
      t.amount_minor,
      t.account_id,
      t.destination_account_id,
      t.category_id,
      (t.note ?? "").trim().toLowerCase(),
    ].join("|");
    const group = groups.get(key);
    if (!group) groups.set(key, { latest: t, count: 1 });
    else {
      group.count++;
      if (t.transaction_date > group.latest.transaction_date) group.latest = t;
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.latest.transaction_date.localeCompare(a.latest.transaction_date),
    )
    .slice(0, limit)
    .map((g) => toQuick(g.latest, g.count));
}
const previousMonth = (month: string) => {
  const d = localDate(month + "-01");
  d.setMonth(d.getMonth() - 1);
  return dateKey(d).slice(0, 7);
};
export interface CategoryChange {
  id: string;
  name: string;
  current: number;
  previous: number;
  /** Signed change against the previous month; null when there was no previous spend. */
  percent: number | null;
}
/** Categories whose spend moved by at least the user's threshold since last month. */
export function categoryChanges(
  transactions: Transaction[],
  categories: Category[],
  month: string,
  thresholdPercent: number,
): CategoryChange[] {
  const before = previousMonth(month);
  return categories
    .map((c) => {
      const current = budgetSpent(transactions, month, c.id),
        previous = budgetSpent(transactions, before, c.id);
      return {
        id: c.id,
        name: c.name,
        current,
        previous,
        percent: previous
          ? Math.round(((current - previous) / previous) * 100)
          : null,
      };
    })
    .filter((c) =>
      c.percent === null
        ? c.current > 0
        : Math.abs(c.percent) >= thresholdPercent,
    )
    .sort(
      (a, b) =>
        Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous),
    );
}
const perMonth: Record<IntervalUnit, number> = {
  DAY: 365.25 / 12,
  WEEK: 365.25 / 12 / 7,
  MONTH: 1,
  YEAR: 1 / 12,
};
const running = (s: Subscription, on: string) =>
  !!s.is_active && (!s.end_date || s.end_date >= on);
/** Average monthly cost of active subscriptions that are spending, not transfers. */
export function subscriptionBurn(
  subscriptions: Subscription[],
  on = dateKey(),
) {
  return Math.round(
    subscriptions
      .filter((s) => running(s, on) && s.payment_type !== "TRANSFER")
      .reduce(
        (n, s) =>
          n + (s.amount_minor * perMonth[s.interval_unit]) / s.interval_count,
        0,
      ),
  );
}
/** Unpaid renewals of active subscriptions inside the user's window, soonest first. */
export function upcomingRenewals(
  subscriptions: Subscription[],
  paid: { subscription_id: string; occurrence_date: string }[],
  windowDays: number,
  now = Date.now(),
) {
  const from = dateKey(now),
    end = new Date(now);
  end.setDate(end.getDate() + windowDays);
  const to = dateKey(end);
  const settled = new Set(
    paid.map((p) => `${p.subscription_id}|${p.occurrence_date}`),
  );
  return subscriptions
    .filter((s) => running(s, from))
    .flatMap((s) =>
      occurrences(
        s.anchor_date,
        s.interval_count,
        s.interval_unit,
        from,
        s.end_date && s.end_date < to ? s.end_date : to,
      )
        .filter((date) => !settled.has(`${s.id}|${date}`))
        .map((date) => ({
          id: s.id,
          title: s.title,
          date,
          amount_minor: s.amount_minor,
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
/**
 * What one scheduled hour of work earns, in minor units: active monthly
 * salary divided by the hours the user's own work schedule plans per month.
 * Returns 0 when there is no salary rule or no scheduled time.
 */
export function hourlyRate(
  salary: SalaryRule[],
  settings: Settings,
  now = Date.now(),
) {
  const monthly = salary
    .filter((r) => r.is_active)
    .reduce((n, r) => n + r.amount_minor, 0);
  let weekMinutes = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    weekMinutes += scheduledMinutes(settings, dateKey(day));
  }
  const monthHours = ((weekMinutes / 60) * 365.25) / 7 / 12;
  return monthHours > 0 ? Math.round(monthly / monthHours) : 0;
}
/** "3h 20m of work" for an amount at a given hourly rate; null when unknown. */
export function workTime(amountMinor: number, rateMinorPerHour: number) {
  if (rateMinorPerHour <= 0 || amountMinor <= 0) return null;
  const minutes = Math.round((amountMinor / rateMinorPerHour) * 60);
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
