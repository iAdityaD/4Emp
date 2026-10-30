import { z } from "zod";
import { Transaction } from "../../domain/models";
import { dateKey, localDate } from "../../domain/shift";
import { IntervalUnit } from "./models";
export const validDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = localDate(s);
    return (
      Number.isFinite(d.getTime()) &&
      dateKey(d) === s &&
      s >= "2000-01-01" &&
      s <= "2200-12-31"
    );
  }, "Use a real date from 2000–2200 (YYYY-MM-DD)");
export const minor = z.number().int().positive().max(9e12);
export function addOccurrence(
  anchor: string,
  index: number,
  count: number,
  unit: IntervalUnit,
) {
  const d = localDate(anchor);
  if (unit === "DAY" || unit === "WEEK") {
    d.setDate(d.getDate() + index * count * (unit === "WEEK" ? 7 : 1));
    return dateKey(d);
  }
  const m = d.getMonth() + index * count * (unit === "YEAR" ? 12 : 1);
  return dateKey(
    new Date(
      d.getFullYear(),
      m,
      Math.min(d.getDate(), new Date(d.getFullYear(), m + 1, 0).getDate()),
    ),
  );
}
export function occurrences(
  anchor: string,
  count: number,
  unit: IntervalUnit,
  from: string,
  to: string,
) {
  validDate.parse(anchor);
  if (!Number.isInteger(count) || count < 1 || count > 120)
    throw Error("Invalid recurrence interval");
  const dates: string[] = [];
  for (let i = 0; i < 80000; i++) {
    const key = addOccurrence(anchor, i, count, unit);
    if (key > to) break;
    if (key >= from) dates.push(key);
  }
  return dates;
}
export function salaryDates(start: string, payday: number, to: string) {
  const a = localDate(start),
    b = localDate(to),
    out: string[] = [];
  for (
    let y = a.getFullYear(), m = a.getMonth();
    y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth());

  ) {
    const key = dateKey(
      new Date(y, m, Math.min(payday, new Date(y, m + 1, 0).getDate())),
    );
    if (key >= start && key <= to) out.push(key);
    m++;
    if (m === 12) {
      y++;
      m = 0;
    }
  }
  return out;
}
export function suggestedEMI(principal: number, bps: number, months: number) {
  const r = bps / 120000;
  return r
    ? Math.ceil(
        (principal * r * Math.pow(1 + r, months)) /
          (Math.pow(1 + r, months) - 1),
      )
    : Math.ceil(principal / months);
}
export function amortization(
  principal: number,
  bps: number,
  months: number,
  emi: number,
  firstDue: string,
) {
  if (
    !Number.isSafeInteger(principal) ||
    principal <= 0 ||
    months < 1 ||
    months > 600 ||
    bps < 0 ||
    bps > 10000
  )
    throw Error("Invalid loan terms");
  let remaining = principal;
  const rows: {
    due_date: string;
    amount_minor: number;
    principal_minor: number;
    interest_minor: number;
  }[] = [];
  for (let i = 0; i < months && remaining > 0; i++) {
    const interest = Math.round((remaining * bps) / 120000);
    if (emi <= interest)
      throw Error("EMI must cover interest and some principal");
    const total = Math.min(emi, remaining + interest),
      paid = total - interest;
    rows.push({
      due_date: addOccurrence(firstDue, i, 1, "MONTH"),
      amount_minor: total,
      principal_minor: paid,
      interest_minor: interest,
    });
    remaining -= paid;
  }
  if (remaining > 0)
    throw Error("EMI is too small for this tenure. Increase EMI or tenure.");
  return rows;
}
export function personalExpenseMinor(t: Transaction) {
  return t.type === "EXPENSE" &&
    t.ledger_kind !== "ADJUSTMENT" &&
    !t.is_reimbursable
    ? t.is_split
      ? Math.round((t.split_my_share ?? t.amount) * 100)
      : t.amount_minor
    : 0;
}
export function monthTotals(transactions: Transaction[], month: string) {
  const rows = transactions.filter((t) =>
    dateKey(Date.parse(t.transaction_date)).startsWith(month),
  );
  const income = rows
    .filter((t) => t.type === "INCOME" && t.ledger_kind === "PERSONAL")
    .reduce((s, t) => s + t.amount_minor, 0);
  const expenses = rows.reduce((s, t) => s + personalExpenseMinor(t), 0);
  return {
    income,
    expenses,
    savings: income - expenses,
    rate: income > 0 ? ((income - expenses) / income) * 100 : 0,
  };
}
export function budgetSpent(
  transactions: Transaction[],
  month: string,
  category: string,
  resetAt?: string | null,
) {
  return transactions
    .filter(
      (t) =>
        (!resetAt || t.transaction_date > resetAt) &&
        t.category_id === category &&
        dateKey(Date.parse(t.transaction_date)).startsWith(month),
    )
    .reduce((s, t) => s + personalExpenseMinor(t), 0);
}
