import React from "react";
import { Pressable, View } from "react-native";
import { cycle } from "../../domain/finance";
import { dateKey } from "../../domain/shift";
import { useStore } from "../../state/store";
import { Button, Card, Edit, Label, Page, Row, useTheme } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { monthTotals } from "./calculations";
import { Money, Progress, Tile } from "./components";
import { monthName } from "./screenKit";
export function FinanceDashboardScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme();
  const month = dateKey().slice(0, 7),
    totals = monthTotals(s.transactions, month),
    balance = s.accounts.reduce((n, a) => n + a.current_balance_minor, 0),
    cash = s.accounts
      .filter((a) => a.account_type === "CASH")
      .reduce((n, a) => n + a.current_balance_minor, 0),
    saved = s.contributions
      .filter((c) => s.goals.some((g) => g.id === c.goal_id && g.is_active))
      .reduce((n, c) => n + c.amount_minor, 0);
  const window = cycle(new Date(), s.settings.cycleDay),
    end = dateKey(window.end);
  const upcoming = s.dueReminders.filter(
    (r) =>
      r.enabled &&
      r.kind !== "SALARY" &&
      r.kind !== "CUSTOM" &&
      r.occurrence_date < end &&
      (r.kind !== "RECURRING" ||
        s.recurring.find((x) => x.id === r.source_id)?.type === "EXPENSE"),
  );
  const committed = upcoming.reduce((n, r) => n + r.amount_minor, 0),
    left = balance - saved - committed,
    days = window.days;
  return (
    <Page
      title="4emp"
      subtitle={new Date().toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      <View
        style={{
          backgroundColor: "#075A62",
          borderRadius: 24,
          padding: 22,
          gap: 15,
        }}
      >
        <Row>
          <Label color="#C4E8E4">TOTAL BALANCE</Label>
          <Pressable
            accessibilityLabel="Show or hide balances"
            onPress={() =>
              void s.configure("hideBalances", !s.settings.hideBalances)
            }
          >
            <Label color="#FFFFFF">
              {s.settings.hideBalances ? "Show" : "Hide"}
            </Label>
          </Pressable>
        </Row>
        <Money
          minor={balance}
          large
          color="#FFFFFF"
          hidden={s.settings.hideBalances}
        />
        <Row>
          {[
            ["Available", left],
            ["Reserved", saved],
            ["Committed", committed],
          ].map(([label, value]) => (
            <View key={label} style={{ gap: 3 }}>
              <Label color="#C4E8E4" size={11}>
                {label}
              </Label>
              <Money
                minor={value as number}
                color="#FFFFFF"
                hidden={s.settings.hideBalances}
              />
            </View>
          ))}
        </Row>
      </View>
      <Row>
        <Button
          title="＋ Add entry"
          onPress={() => nav.navigate("QuickEntry")}
        />
        <Button
          title="⇄ Transfer"
          secondary
          onPress={() => nav.navigate("Transfer")}
        />
      </Row>
      <Row>
        <Label weight>This month</Label>
        <Label muted size={12}>
          {monthName(month)}
        </Label>
      </Row>
      <Card>
        <Row>
          <View>
            <Label muted>Income</Label>
            <Money
              minor={totals.income}
              color={t.success}
              hidden={s.settings.hideBalances}
            />
          </View>
          <View>
            <Label muted>Expenses</Label>
            <Money
              minor={totals.expenses}
              color={t.danger}
              hidden={s.settings.hideBalances}
            />
          </View>
        </Row>
        <Progress
          value={
            totals.income ? Math.max(0, totals.savings / totals.income) : 0
          }
        />
        <Label muted size={12}>
          {totals.income
            ? "Savings rate " + totals.rate.toFixed(1) + "%"
            : "Add income to calculate your savings rate."}
        </Label>
      </Card>
      <Card>
        <Row>
          <View>
            <Label muted>Safe daily spend</Label>
            <Money
              minor={Math.floor(left / days)}
              color={left < 0 ? t.danger : t.success}
              hidden={s.settings.hideBalances}
            />
          </View>
          <View>
            <Label muted>Available cash</Label>
            <Money minor={cash} hidden={s.settings.hideBalances} />
          </View>
        </Row>
        <Label muted size={12}>
          Unreserved liquidity after unpaid and overdue obligations through your
          cycle end, divided by {days} remaining calendar days. Negative amounts
          show a shortfall.
        </Label>
      </Card>
      <Tile
        title="Spending overview"
        subtitle="Trends, categories and savings rate"
        icon="pie-chart-outline"
        onPress={() => nav.navigate("Analytics")}
      />
      <Row>
        <Label weight>Your accounts</Label>
        <Edit
          label="Manage accounts"
          onPress={() => nav.navigate("Accounts")}
        />
      </Row>
      {s.accounts.map((a) => (
        <Tile
          key={a.id}
          title={a.name}
          subtitle={a.account_type.replace("_", " ")}
          color={a.color_hex}
          icon="wallet-outline"
          right={
            <Money
              minor={a.current_balance_minor}
              hidden={s.settings.hideBalances}
            />
          }
          onPress={() => nav.navigate("AccountEdit", { id: a.id })}
        />
      ))}
      <Row>
        <Button
          title="Plan money"
          secondary
          onPress={() => nav.navigate("Planning")}
        />
        <Button
          title="Due calendar"
          secondary
          onPress={() => nav.navigate("FinanceCalendar")}
        />
      </Row>
    </Page>
  );
}
