import { Transaction } from "../../domain/models";
import { dateKey, localDate } from "../../domain/shift";
export function balanceSeries(
  entries: Transaction[],
  currentMinor: number,
  days = 14,
  now = new Date(),
) {
  const end = dateKey(now);
  let closing = currentMinor;
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = localDate(end);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    out.unshift({ date: key, value: closing });
    closing -= entries
      .filter((e) => dateKey(Date.parse(e.transaction_date)) === key)
      .reduce(
        (n, e) =>
          n +
          (e.type === "INCOME"
            ? e.amount_minor
            : e.type === "EXPENSE"
              ? -e.amount_minor
              : 0),
        0,
      );
  }
  return out;
}
export function shareSegments(
  rows: { id: string; name: string; color_hex: string; value: number }[],
) {
  return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}
