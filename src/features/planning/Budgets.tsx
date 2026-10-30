import React, { useState } from "react";
import { Pressable } from "react-native";
import { currency } from "../../domain/finance";
import { dateKey } from "../../domain/shift";
import { useStore } from "../../state/store";
import { Card, Label, Page, Row, useTheme } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton } from "../design/primitives";
import { budgetSpent } from "./calculations";
import { Money, Progress } from "./components";
import { Empty, MonthPicker } from "./screenKit";
export function BudgetsScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme(),
    [month, setMonth] = useState(dateKey().slice(0, 7));
  const rows = s.budgets.filter((b) => b.month === month);
  return (
    <Page
      title="Monthly budgets"
      trailing={
        <IconButton
          icon="add"
          label="New budget"
          onPress={() => nav.navigate("PlanEdit", { kind: "budgets" })}
        />
      }
    >
      <MonthPicker month={month} onChange={setMonth} />
      {!rows.length && <Empty text="No budgets this month" />}
      {rows.map((b) => {
        const spent = budgetSpent(
          s.transactions,
          month,
          b.category_id,
          b.reset_at,
        );
        return (
          <Pressable
            key={b.id}
            onPress={() =>
              nav.navigate("PlanEdit", { kind: "budgets", id: b.id })
            }
          >
            <Card>
              <Row>
                <Label weight>
                  {s.categories.find((c) => c.id === b.category_id)?.name ??
                    "Archived category"}
                </Label>
                <Label color={spent > b.limit_minor ? t.danger : t.success}>
                  {((spent / b.limit_minor) * 100).toFixed(0)}%
                </Label>
              </Row>
              <Row>
                <Money minor={spent} />
                <Label muted>
                  of {currency(b.limit_minor / 100, s.settings.currency)}
                </Label>
              </Row>
              <Progress
                value={spent / b.limit_minor}
                color={spent > b.limit_minor ? t.danger : t.accent}
              />
              <Label muted size={12}>
                {spent > b.limit_minor
                  ? "Over by " +
                    currency((spent - b.limit_minor) / 100, s.settings.currency)
                  : currency(
                      (b.limit_minor - spent) / 100,
                      s.settings.currency,
                    ) + " remaining"}{" "}
              </Label>
            </Card>
          </Pressable>
        );
      })}
    </Page>
  );
}
