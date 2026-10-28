import React from "react";
import { Page } from "../../ui/kit";
import { RootStack, useNav } from "../../ui/navigation";
import { Tile } from "./components";
export function PlanningScreen() {
  const nav = useNav();
  const items: [string, string, keyof RootStack][] = [
    ["Salary", "Paydays and recurring income", "Salary"],
    ["Loans & EMIs", "Principal, interest and payment schedule", "Loans"],
    ["Subscriptions", "Flexible renewal cycles", "Subscriptions"],
    ["Recurring entries", "Automatic or reminder-only rules", "Recurring"],
    ["Budgets", "Category limits and alerts", "Budgets"],
    ["Savings goals", "Reserve, contribute and track progress", "Goals"],
    ["Due calendar", "Salary, EMIs, bills and renewals", "FinanceCalendar"],
    ["Reminders", "Local alerts and due-date details", "Reminders"],
  ];
  return (
    <Page
      title="Plan your money"
      subtitle="Your rules. Your pace. Everything stays on this device."
    >
      {items.map(([title, subtitle, route]) => (
        <Tile
          key={route}
          title={title}
          subtitle={subtitle}
          onPress={() => nav.navigate(route as "Salary")}
        />
      ))}
    </Page>
  );
}
