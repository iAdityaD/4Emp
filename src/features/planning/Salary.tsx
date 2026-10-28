import React from "react";
import { useStore } from "../../state/store";
import { PlanList } from "./screenKit";
export function SalaryScreen() {
  const s = useStore();
  return (
    <PlanList
      kind="salary"
      title="Salary"
      description="Net pay, payday, destination and posting behavior."
      rows={s.salary.map((r) => ({
        id: r.id,
        title: r.title,
        amount: r.amount_minor,
        subtitle: `Day ${r.payday} · ${r.auto_post ? "Auto-post" : "Reminder only"} · ${r.is_active ? "Active" : "Paused"}`,
      }))}
    />
  );
}
export function RecurringScreen() {
  const s = useStore();
  return (
    <PlanList
      kind="recurring"
      title="Recurring entries"
      description="Income, expenses or transfers. One entry per rule and date."
      rows={s.recurring.map((r) => ({
        id: r.id,
        title: r.title,
        amount: r.amount_minor,
        subtitle: `Every ${r.interval_count} ${r.interval_unit.toLowerCase()} · ${r.auto_post ? "Automatic" : "Manual"} · ${r.is_active ? "Active" : "Paused"}`,
      }))}
    />
  );
}
