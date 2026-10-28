import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { dateKey, localDate } from "../../domain/shift";
import { PlanningRepository } from "../../repositories/PlanningRepository";
import { postPlanned } from "../../services/recurrence";
import { useStore } from "../../state/store";
import { act, Button, Card, Label, Page, useTheme } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { Money, Tile } from "./components";
import { MonthPicker } from "./screenKit";
export function FinanceCalendarScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme();
  const [month, setMonth] = useState(dateKey().slice(0, 7)),
    [selected, setSelected] = useState(dateKey());
  const start = localDate(month + "-01"),
    offset = (start.getDay() + 6) % 7,
    total = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const dues = s.dueReminders.filter(
    (r) =>
      r.enabled && r.status !== "DISMISSED" && r.occurrence_date === selected,
  );
  const ledger = s.transactions.filter(
    (x) => dateKey(Date.parse(x.transaction_date)) === selected,
  );
  return (
    <Page
      title="Money calendar"
      subtitle="Salary, renewals, EMIs, bills and recorded activity."
    >
      <MonthPicker
        month={month}
        onChange={(v) => {
          setMonth(v);
          setSelected(v + "-01");
        }}
      />
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <View
              key={i}
              style={{ width: "14.28%", alignItems: "center", padding: 8 }}
            >
              <Label muted size={11}>
                {d}
              </Label>
            </View>
          ))}
          {Array.from({ length: offset + total }, (_, i) => {
            const day = i - offset + 1,
              key = `${month}-${String(day).padStart(2, "0")}`,
              events = s.dueReminders.filter(
                (r) => r.enabled && r.occurrence_date === key,
              );
            return (
              <Pressable
                key={i}
                disabled={day < 1}
                accessibilityLabel={day > 0 ? key : undefined}
                onPress={() => setSelected(key)}
                style={{
                  width: "14.28%",
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 24,
                  backgroundColor: selected === key ? t.accent : "transparent",
                }}
              >
                {day > 0 && (
                  <>
                    <Label color={selected === key ? t.onAccent : t.text}>
                      {day}
                    </Label>
                    {events.length > 0 && (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor:
                            selected === key ? "#FFFFFF" : t.danger,
                        }}
                      />
                    )}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Label weight>{selected} · Planned</Label>
      {!dues.length && <Label muted>No unpaid due items.</Label>}
      {dues.map((r) => (
        <Tile
          key={r.id}
          title={r.title}
          subtitle={r.kind}
          right={<Money minor={r.amount_minor} />}
          onPress={() => nav.navigate("DueDetails", { id: r.id })}
        />
      ))}
      <Label weight>Recorded</Label>
      {!ledger.length && <Label muted>No transactions.</Label>}
      {ledger.map((r) => (
        <Tile
          key={r.id}
          title={r.note || r.type}
          subtitle={r.type}
          right={
            <Money
              minor={r.type === "INCOME" ? r.amount_minor : -r.amount_minor}
            />
          }
          onPress={() => nav.navigate("TransactionDetails", { id: r.id })}
        />
      ))}
    </Page>
  );
}
export function DueDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav();
  const r = s.dueReminders.find((r) => r.id === id);
  if (!r)
    return (
      <Page title="Due item unavailable">
        <Label>The plan changed or was paid.</Label>
      </Page>
    );
  return (
    <Page title={r.title} subtitle={`${r.kind} · ${r.occurrence_date}`}>
      <Card>
        <Money minor={r.amount_minor} large />
        <Label muted>
          Reminder {new Date(r.notification_at).toLocaleString()}
        </Label>
        {r.kind === "BILL" ? (
          <Button
            title="Monthly bill details"
            onPress={() => nav.navigate("Commitments")}
          />
        ) : r.kind === "EMI" ? (
          <Button
            title="Loan payment schedule"
            onPress={() => nav.navigate("LoanDetails", { id: r.source_id })}
          />
        ) : r.kind === "SUBSCRIPTION" ? (
          <Button
            title="Subscription details"
            onPress={() =>
              nav.navigate("SubscriptionDetails", { id: r.source_id })
            }
          />
        ) : ["SALARY", "RECURRING"].includes(r.kind) ? (
          <>
            <Button
              title="Record this occurrence"
              disabled={r.occurrence_date > dateKey()}
              onPress={() =>
                void act(
                  () =>
                    postPlanned(
                      r.kind as "SALARY" | "RECURRING",
                      r.source_id,
                      r.occurrence_date,
                    ),
                  () => nav.goBack(),
                )
              }
            />
            <Button
              title="Edit rule"
              secondary
              onPress={() =>
                nav.navigate("PlanEdit", {
                  kind: r.kind === "SALARY" ? "salary" : "recurring",
                  id: r.source_id,
                })
              }
            />
          </>
        ) : (
          <Button
            title="Edit personal reminder"
            onPress={() => nav.navigate("ReminderEdit", { id: r.id })}
          />
        )}
        <Button
          title="Dismiss reminder"
          secondary
          onPress={() =>
            void act(
              () => PlanningRepository.dismissReminder(id),
              () => nav.goBack(),
            )
          }
        />
      </Card>
    </Page>
  );
}
