import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";
import { dateKey } from "../../domain/shift";
import { PlanningRepository } from "../../repositories/PlanningRepository";
import { useStore } from "../../state/store";
import { act, Button, Card, Chips, Edit, Label, Page, Row } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { occurrences } from "./calculations";
import { AccountChoice, Money, Tile } from "./components";
export function SubscriptionsScreen() {
  const s = useStore(),
    nav = useNav();
  const [active, setActive] = useState("ACTIVE");
  return (
    <Page
      title="Subscriptions"
      subtitle="Track renewals with any billing interval."
    >
      <Chips
        values={["ACTIVE", "INACTIVE"]}
        value={active}
        onChange={setActive}
      />
      <Button
        title="＋ New subscription"
        onPress={() => nav.navigate("PlanEdit", { kind: "subscriptions" })}
      />
      {s.subscriptions
        .filter((x) => !!x.is_active === (active === "ACTIVE"))
        .map((r) => {
          const dates = occurrences(
            r.anchor_date,
            r.interval_count,
            r.interval_unit,
            r.anchor_date,
            dateKey(
              new Date(
                new Date().getFullYear() + 1,
                new Date().getMonth(),
                new Date().getDate(),
              ),
            ),
          );
          const next = dates.find(
            (d) =>
              !s.subscriptionPayments.some(
                (p) => p.subscription_id === r.id && p.occurrence_date === d,
              ),
          );
          return (
            <Tile
              key={r.id}
              title={r.title}
              subtitle={`Every ${r.interval_count} ${r.interval_unit.toLowerCase()} · Next unpaid ${next ?? "outside forecast"}`}
              icon="repeat-outline"
              right={<Money minor={r.amount_minor} />}
              onPress={() => nav.navigate("SubscriptionDetails", { id: r.id })}
            />
          );
        })}
    </Page>
  );
}
export function SubscriptionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav();
  const r = s.subscriptions.find((r) => r.id === id),
    [account, setAccount] = useState(r?.account_id ?? "");
  if (!r)
    return (
      <Page title="Subscription unavailable">
        <Label>No record.</Label>
      </Page>
    );
  const dates = occurrences(
    r.anchor_date,
    r.interval_count,
    r.interval_unit,
    r.anchor_date,
    dateKey(
      new Date(
        new Date().getFullYear() + 1,
        new Date().getMonth(),
        new Date().getDate(),
      ),
    ),
  );
  const unpaid = dates.filter(
    (d) =>
      !s.subscriptionPayments.some(
        (p) => p.subscription_id === id && p.occurrence_date === d,
      ),
  );
  return (
    <Page
      title={r.title}
      subtitle={`Every ${r.interval_count} ${r.interval_unit.toLowerCase()} · ${r.remind_days} day reminder`}
    >
      <Card>
        <Money minor={r.amount_minor} large />
        <Edit
          onPress={() =>
            nav.navigate("PlanEdit", { kind: "subscriptions", id })
          }
        />
        <Label muted>Pay using</Label>
        <AccountChoice value={account} onChange={setAccount} />
      </Card>
      <Label weight>Next renewals</Label>
      {unpaid.slice(0, 12).map((d) => (
        <Card key={d}>
          <Row>
            <Label>
              {d}
              {d < dateKey() ? " · overdue" : ""}
            </Label>
            <Money minor={r.amount_minor} />
          </Row>
          <Button
            title="Record renewal payment"
            disabled={!r.is_active}
            onPress={() =>
              Alert.alert("Record this renewal?", d, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Record",
                  onPress: () =>
                    void act(() =>
                      PlanningRepository.paySubscription(id, d, account),
                    ),
                },
              ])
            }
          />
        </Card>
      ))}
      <Label weight>Payment history</Label>
      {s.subscriptionPayments
        .filter((p) => p.subscription_id === id)
        .map((p) => (
          <Tile
            key={p.occurrence_date}
            title={p.occurrence_date}
            subtitle="Paid · tap to view or reverse"
            onPress={() =>
              nav.navigate("TransactionDetails", { id: p.transaction_id })
            }
          />
        ))}
    </Page>
  );
}
