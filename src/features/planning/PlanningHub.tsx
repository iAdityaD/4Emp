import React from "react";
import { View } from "react-native";
import { currency } from "../../domain/finance";
import { dateKey } from "../../domain/shift";
import { useStore } from "../../state/store";
import { Card, Label, Page, useTheme } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { ProgressOrbit } from "../design/charts";
import {
  ActionDock,
  FeatureCard,
  IconButton,
  MenuRow,
  Section,
} from "../design/primitives";
import { budgetSpent } from "./calculations";
export function PlanningScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme(),
    month = dateKey().slice(0, 7);
  const saved = s.contributions
      .filter((c) => s.goals.some((g) => g.id === c.goal_id && g.is_active))
      .reduce((n, c) => n + c.amount_minor, 0),
    target = s.goals
      .filter((g) => g.is_active)
      .reduce((n, g) => n + g.target_minor, 0),
    budget = s.budgets.filter((b) => b.month === month),
    limit = budget.reduce((n, b) => n + b.limit_minor, 0),
    spent = budget.reduce(
      (n, b) => n + budgetSpent(s.transactions, month, b.category_id),
      0,
    ),
    emi = s.loans
      .filter((l) => l.is_active)
      .reduce((n, l) => n + l.emi_minor, 0);
  return (
    <Page
      title="Plan"
      trailing={
        <IconButton
          icon="calendar-outline"
          label="Finance calendar"
          onPress={() => nav.navigate("FinanceCalendar")}
        />
      }
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Card>
            <ProgressOrbit
              size={100}
              value={limit ? spent / limit : 0}
              color={spent > limit ? t.danger : t.accent}
            />
            <Label size={12} weight>
              Budget used
            </Label>
            <Label muted size={11}>
              {limit
                ? currency(spent / 100, s.settings.currency)
                : "No budget set"}
            </Label>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <ProgressOrbit
              size={100}
              value={target ? saved / target : 0}
              color={t.cyan}
            />
            <Label size={12} weight>
              Goals saved
            </Label>
            <Label muted size={11}>
              {currency(saved / 100, s.settings.currency)}
            </Label>
          </Card>
        </View>
      </View>
      <Section title="Your plans" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <FeatureCard
          title="Budgets"
          icon="pie-chart-outline"
          value={String(budget.length)}
          caption="This month"
          onPress={() => nav.navigate("Budgets")}
        />
        <FeatureCard
          title="Goals"
          icon="flag-outline"
          color={t.cyan}
          value={String(s.goals.filter((g) => g.is_active).length)}
          caption="Active"
          onPress={() => nav.navigate("Goals")}
        />
        <FeatureCard
          title="Loans & EMIs"
          icon="card-outline"
          color={t.purple}
          value={currency(emi / 100, s.settings.currency)}
          caption="Monthly EMI"
          onPress={() => nav.navigate("Loans")}
        />
        <FeatureCard
          title="Subscriptions"
          icon="repeat-outline"
          color={t.orange}
          value={String(s.subscriptions.filter((x) => x.is_active).length)}
          caption="Active"
          onPress={() => nav.navigate("Subscriptions")}
        />
      </View>
      <ActionDock
        actions={[
          {
            label: "Salary",
            icon: "briefcase-outline",
            onPress: () => nav.navigate("Salary"),
          },
          {
            label: "Recurring",
            icon: "sync-outline",
            onPress: () => nav.navigate("Recurring"),
          },
          {
            label: "Due dates",
            icon: "notifications-outline",
            onPress: () => nav.navigate("Reminders"),
          },
          {
            label: "Claims",
            icon: "business-outline",
            onPress: () => nav.navigate("Reimbursements"),
          },
        ]}
      />
      <Card>
        <MenuRow
          title="Monthly bills"
          icon="receipt-outline"
          value={String(s.commitments.length)}
          onPress={() => nav.navigate("Commitments")}
        />
      </Card>
    </Page>
  );
}
