import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Rect, Text as SVGText } from "react-native-svg";
import { dateKey, localDate } from "../../domain/shift";
import { useStore } from "../../state/store";
import { Card, Chips, Label, Page, Row, useTheme } from "../../ui/kit";
import { budgetSpent, monthTotals, personalExpenseMinor } from "./calculations";
import { Money, Progress } from "./components";
import { monthName, MonthPicker } from "./screenKit";
export function AdvancedAnalyticsScreen() {
  const s = useStore(),
    t = useTheme(),
    [month, setMonth] = useState(dateKey().slice(0, 7)),
    [range, setRange] = useState("6");
  const totals = monthTotals(s.transactions, month);
  const categories = s.categories
    .map((c) => ({ ...c, spent: budgetSpent(s.transactions, month, c.id) }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const uncategorized = s.transactions
    .filter(
      (x) =>
        !x.category_id &&
        dateKey(Date.parse(x.transaction_date)).startsWith(month),
    )
    .reduce((n, x) => n + personalExpenseMinor(x), 0);
  if (uncategorized)
    categories.push({
      id: "uncategorized",
      name: "Uncategorized",
      icon_name: "ellipse-outline",
      color_hex: t.muted,
      kind: "EXPENSE",
      is_active: 1,
      is_system: 0,
      spent: uncategorized,
    });
  categories.sort((a, b) => b.spent - a.spent);
  const chart = Array.from({ length: Number(range) }, (_, i) => {
    const d = localDate(month + "-01");
    d.setMonth(d.getMonth() - (Number(range) - 1 - i));
    const key = dateKey(d).slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString([], { month: "short" }),
      ...monthTotals(s.transactions, key),
    };
  });
  const max = Math.max(1, ...chart.flatMap((r) => [r.income, r.expenses]));
  let offset = 0;
  const circumference = 2 * Math.PI * 55;
  return (
    <Page title="Insights">
      <MonthPicker month={month} onChange={setMonth} />
      <Card>
        <Row>
          <View>
            <Label muted>Income</Label>
            <Money minor={totals.income} color={t.success} />
          </View>
          <View>
            <Label muted>Expenses</Label>
            <Money minor={totals.expenses} color={t.danger} />
          </View>
        </Row>
        <Row>
          <Label>Savings rate</Label>
          <Label color={totals.rate < 0 ? t.danger : t.success} weight>
            {totals.income ? totals.rate.toFixed(1) + "%" : "—"}
          </Label>
        </Row>
        <Money minor={totals.savings} />
      </Card>
      <Chips
        values={["6", "12"]}
        labels={{ "6": "6 months", "12": "12 months" }}
        value={range}
        onChange={setRange}
      />
      <Card>
        <Label weight>Monthly trends</Label>
        <Svg viewBox="0 0 330 180" width="100%" height={180}>
          {chart.map((r, i) => {
            const cell = 320 / chart.length;
            return (
              <G key={r.key}>
                <Rect
                  x={i * cell + 5}
                  y={150 - (r.income / max) * 130}
                  width={cell * 0.3}
                  height={(r.income / max) * 130}
                  fill={t.success}
                  rx={2}
                />
                <Rect
                  x={i * cell + 6 + cell * 0.3}
                  y={150 - (r.expenses / max) * 130}
                  width={cell * 0.3}
                  height={(r.expenses / max) * 130}
                  fill={t.danger}
                  rx={2}
                />
                <SVGText
                  x={i * cell + cell / 2}
                  y={172}
                  fontSize={8}
                  fill={t.muted}
                  textAnchor="middle"
                >
                  {r.label}
                </SVGText>
              </G>
            );
          })}
        </Svg>
        <Label muted size={12}>
          Green: income · Coral: personal expenses
        </Label>
      </Card>
      <Card>
        <Label weight>Category breakdown</Label>
        <Row>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Circle
              cx={75}
              cy={75}
              r={55}
              stroke={t.line}
              strokeWidth={18}
              fill="none"
            />
            {categories.map((c) => {
              const portion = c.spent / (totals.expenses || 1),
                start = offset;
              offset += portion;
              return (
                <Circle
                  key={c.id}
                  cx={75}
                  cy={75}
                  r={55}
                  stroke={c.color_hex}
                  strokeWidth={18}
                  fill="none"
                  strokeDasharray={`${portion * circumference} ${circumference}`}
                  strokeDashoffset={-start * circumference}
                  rotation={-90}
                  origin="75,75"
                />
              );
            })}
            <SVGText
              x={75}
              y={79}
              fill={t.text}
              fontSize={13}
              textAnchor="middle"
            >
              {categories.length ? "Spent" : "No data"}
            </SVGText>
          </Svg>
          <View style={{ flex: 1 }}>
            <Money minor={totals.expenses} />
            <Label muted size={12}>
              {monthName(month)}
            </Label>
          </View>
        </Row>
        {categories.map((c) => (
          <View key={c.id} style={{ gap: 6 }}>
            <Row>
              <Label>{c.name}</Label>
              <Money minor={c.spent} />
            </Row>
            <Progress
              value={c.spent / (totals.expenses || 1)}
              color={c.color_hex}
            />
          </View>
        ))}
        {!categories.length && (
          <Label muted>No personal expenses recorded in this month.</Label>
        )}
      </Card>
    </Page>
  );
}
