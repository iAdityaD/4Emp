import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, View } from "react-native";
import { cycle } from "../../domain/finance";
import { dateKey } from "../../domain/shift";
import { useStore } from "../../state/store";
import { Card, Label, Page, Row, useTheme } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { Donut, Sparkline } from "../design/charts";
import { balanceSeries } from "../design/metrics";
import {
  ActionDock,
  IconButton,
  InfoButton,
  Section,
} from "../design/primitives";
import { budgetSpent, monthTotals, personalExpenseMinor } from "./calculations";
import { Money } from "./components";
export function FinanceDashboardScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme();
  const month = dateKey().slice(0, 7),
    totals = monthTotals(s.transactions, month),
    balance = s.accounts.reduce((n, a) => n + a.current_balance_minor, 0),
    reserved = s.contributions
      .filter((c) => s.goals.some((g) => g.id === c.goal_id && g.is_active))
      .reduce((n, c) => n + c.amount_minor, 0),
    end = dateKey(cycle(new Date(), s.settings.cycleDay).end);
  const committed = s.dueReminders
      .filter(
        (r) =>
          r.enabled &&
          r.kind !== "SALARY" &&
          r.kind !== "CUSTOM" &&
          r.occurrence_date < end &&
          (r.kind !== "RECURRING" ||
            s.recurring.find((x) => x.id === r.source_id)?.type === "EXPENSE"),
      )
      .reduce((n, r) => n + r.amount_minor, 0),
    available = balance - reserved - committed,
    days = cycle(new Date(), s.settings.cycleDay).days,
    hidden = s.settings.hideBalances;
  const categories = s.categories
    .map((c) => ({ ...c, value: budgetSpent(s.transactions, month, c.id) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const uncategorized = s.transactions
    .filter(
      (x) =>
        !x.category_id &&
        dateKey(Date.parse(x.transaction_date)).startsWith(month),
    )
    .reduce((n, x) => n + personalExpenseMinor(x), 0);
  const segments = [
    ...categories.map((c) => ({ value: c.value, color: c.color_hex })),
    ...(uncategorized ? [{ value: uncategorized, color: t.muted }] : []),
  ];
  const trend = balanceSeries(s.transactions, balance);
  return (
    <Page
      title="4emp"
      subtitle={new Date().toLocaleDateString([], {
        month: "short",
        day: "numeric",
        weekday: "short",
      })}
      trailing={
        <IconButton
          icon="wallet-outline"
          label="Accounts"
          onPress={() => nav.navigate("Accounts")}
        />
      }
    >
      <View
        style={{
          backgroundColor: "#075A62",
          borderRadius: 26,
          padding: 21,
          gap: 8,
        }}
      >
        <Row>
          <Label color="#C1E8E4" size={11}>
            TOTAL BALANCE
          </Label>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show or hide balances"
            onPress={() => void s.configure("hideBalances", !hidden)}
            style={{ padding: 8 }}
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={21}
              color="#C1E8E4"
            />
          </Pressable>
        </Row>
        <Money large minor={balance} color="#FFFFFF" hidden={hidden} />
        {!hidden && (
          <Sparkline
            values={trend.map((p) => p.value)}
            color="#6ADBC3"
            height={52}
          />
        )}
        <Row>
          <View>
            <Label size={11} color="#C1E8E4">
              Available
            </Label>
            <Money minor={available} color="#FFFFFF" hidden={hidden} />
          </View>
          <View>
            <Label size={11} color="#C1E8E4">
              Reserved
            </Label>
            <Money minor={reserved} color="#FFFFFF" hidden={hidden} />
          </View>
          <View>
            <Label size={11} color="#C1E8E4">
              Due
            </Label>
            <Money minor={committed} color="#FFFFFF" hidden={hidden} />
          </View>
        </Row>
      </View>
      <ActionDock
        actions={[
          {
            label: "Expense",
            icon: "arrow-up-outline",
            color: t.danger,
            onPress: () => nav.navigate("QuickEntry", { type: "EXPENSE" }),
          },
          {
            label: "Income",
            icon: "arrow-down-outline",
            color: t.success,
            onPress: () => nav.navigate("QuickEntry", { type: "INCOME" }),
          },
          {
            label: "Transfer",
            icon: "swap-horizontal-outline",
            color: t.cyan,
            onPress: () => nav.navigate("QuickEntry", { type: "TRANSFER" }),
          },
        ]}
      />
      <Section
        title="This month"
        action="Insights"
        onPress={() => nav.navigate("Analytics")}
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          {
            name: "Income",
            value: totals.income,
            icon: "arrow-down" as const,
            color: t.success,
          },
          {
            name: "Expenses",
            value: totals.expenses,
            icon: "arrow-up" as const,
            color: t.danger,
          },
        ].map((v) => (
          <View key={v.name} style={{ flex: 1 }}>
            <Card>
              <Row>
                <Ionicons name={v.icon} size={17} color={v.color} />
                <Label muted size={11}>
                  {v.name}
                </Label>
              </Row>
              <Money minor={v.value} color={v.color} hidden={hidden} />
            </Card>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Spending insights"
        onPress={() => nav.navigate("Analytics")}
      >
        <Card>
          <Row>
            <Donut size={128} segments={segments}>
              <Label size={13} weight>
                {totals.expenses ? "Spent" : "No spending"}
              </Label>
            </Donut>
            <View style={{ flex: 1, gap: 9 }}>
              <Money minor={totals.expenses} hidden={hidden} />
              {categories.slice(0, 3).map((c) => (
                <View
                  key={c.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: c.color_hex,
                    }}
                  />
                  <Label muted size={11}>
                    {c.name}
                  </Label>
                </View>
              ))}
            </View>
            <Ionicons name="chevron-forward" color={t.muted} size={17} />
          </Row>
        </Card>
      </Pressable>
      <Card>
        <Row>
          <View>
            <Label muted size={11}>
              Safe to spend · per day
            </Label>
            <Money
              minor={Math.floor(available / days)}
              color={available < 0 ? t.danger : t.success}
              hidden={hidden}
            />
          </View>
          <InfoButton
            title="Safe to spend"
            text={`Balance minus goal reservations and unpaid obligations through ${end}, divided by ${days} days. A negative value is a shortfall.`}
          />
        </Row>
      </Card>
    </Page>
  );
}
