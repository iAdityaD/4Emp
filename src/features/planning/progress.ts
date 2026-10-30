import { Account, Transaction } from "../../domain/models";
import { dateKey } from "../../domain/shift";
import { Goal, Contribution, Subscription } from "./models";
import { monthTotals, occurrences } from "./calculations";
export function goalProgress(
  g: Goal,
  accounts: Account[],
  transactions: Transaction[],
  contributions: Contribution[],
  month = dateKey().slice(0, 7),
) {
  if (!g.tracking_basis || g.tracking_basis === "CONTRIBUTIONS")
    return contributions
      .filter((c) => c.goal_id === g.id)
      .reduce((n, c) => n + c.amount_minor, 0);
  const selected = g.account_id
    ? accounts.filter((a) => a.id === g.account_id)
    : accounts;
  if (g.tracking_basis === "BALANCE")
    return selected.reduce((n, a) => n + a.current_balance_minor, 0);
  return monthTotals(
    transactions.filter((t) => !g.account_id || t.account_id === g.account_id),
    month,
  ).savings;
}
export function subscriptionDates(s: Subscription, to: string) {
  return occurrences(
    s.anchor_date,
    s.interval_count,
    s.interval_unit,
    s.anchor_date,
    s.end_date && s.end_date < to ? s.end_date : to,
  );
}
