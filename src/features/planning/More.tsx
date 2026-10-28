import React from "react";
import { Page } from "../../ui/kit";
import { RootStack, useNav } from "../../ui/navigation";
import { Tile } from "./components";
export function MoreScreen() {
  const nav = useNav();
  const items: [
    string,
    string,
    keyof RootStack,
    React.ComponentProps<typeof Tile>["icon"],
  ][] = [
    [
      "Planning",
      "Salary, loans, subscriptions, goals and budgets",
      "Planning",
      "grid-outline",
    ],
    [
      "Accounts",
      "Balances, banks, wallets and cash",
      "Accounts",
      "wallet-outline",
    ],
    [
      "Categories",
      "Your classifications, icons and colors",
      "Categories",
      "pricetags-outline",
    ],
    [
      "Finance calendar",
      "Bills, renewals and payday",
      "FinanceCalendar",
      "calendar-outline",
    ],
    [
      "Reminders",
      "Upcoming and overdue finance items",
      "Reminders",
      "notifications-outline",
    ],
    [
      "Work calendar",
      "Attendance, leave, holidays and logs",
      "Calendar",
      "calendar-number-outline",
    ],
    [
      "Work settings",
      "Weekly targets and reusable profiles",
      "WorkSettings",
      "time-outline",
    ],
    [
      "Reimbursements",
      "Pending and settled employer receivables",
      "Reimbursements",
      "business-outline",
    ],
    [
      "Monthly bills",
      "Simple recurring monthly commitments",
      "Commitments",
      "receipt-outline",
    ],
    [
      "Backup & restore",
      "Encrypted local backup and CSV exports",
      "Backup",
      "cloud-download-outline",
    ],
    ["Security", "Biometric app lock", "Security", "shield-checkmark-outline"],
    [
      "Settings",
      "Theme, currency and notifications",
      "Settings",
      "settings-outline",
    ],
  ];
  return (
    <Page title="More" subtitle="Make 4emp work the way you do.">
      {items.map(([title, subtitle, name, icon]) => (
        <Tile
          key={name}
          title={title}
          subtitle={subtitle}
          icon={icon}
          onPress={() => nav.navigate(name as "Salary")}
        />
      ))}
    </Page>
  );
}
