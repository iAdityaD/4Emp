import { Account, Commitment, Transaction } from "./models";
import { dateKey, localDate } from "./shift";
export function cents(amount: number): number {
  if (!Number.isFinite(amount) || Math.abs(amount) > 1e10)
    throw Error("Invalid amount");
  return Math.round(amount * 100);
}
export function parseAmount(input: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(input))
    throw Error("Enter a positive amount with at most two decimal places");
  const n = cents(Number(input));
  if (n <= 0) throw Error("Amount must be positive");
  return n / 100;
}
export function expenseShare(t: Transaction): number {
  return t.type === "EXPENSE"
    ? cents(t.is_split ? (t.split_my_share ?? t.amount) : t.amount) / 100
    : 0;
}
export function liquidity(accounts: Account[]) {
  return accounts.reduce((sum, a) => sum + cents(a.current_balance), 0) / 100;
}
export function cycle(now: Date, day: number) {
  const boundary = (y: number, m: number) =>
    new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let start = boundary(now.getFullYear(), now.getMonth());
  if (now < start) start = boundary(now.getFullYear(), now.getMonth() - 1);
  const end = boundary(start.getFullYear(), start.getMonth() + 1);
  const today = localDate(dateKey(now));
  const days = Math.max(
    1,
    Math.round(
      (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
        86400000,
    ),
  );
  return { start, end, key: dateKey(start), days };
}
export function dueDate(year: number, month: number, day: number) {
  return new Date(
    year,
    month,
    Math.min(day, new Date(year, month + 1, 0).getDate()),
  );
}
export function obligationDate(c: Commitment, start: Date, end: Date) {
  let due = dueDate(start.getFullYear(), start.getMonth(), c.due_day_of_month);
  if (due < start)
    due = dueDate(
      start.getFullYear(),
      start.getMonth() + 1,
      c.due_day_of_month,
    );
  return due < end ? due : null;
}
export function runway(balance: number, unpaid: number, days: number) {
  const reserve = (cents(balance) - cents(unpaid)) / 100;
  return { reserve, daily: reserve / Math.max(1, days) };
}
export function currency(amount: number, code = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(amount);
}
