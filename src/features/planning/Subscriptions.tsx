import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { dateKey } from "../../domain/shift";
import { useStore } from "../../state/store";
import { Card, Chips, Label, Page, useTheme } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton, MenuRow } from "../design/primitives";
import { openField } from "../editor/Screens";
import { subscriptionDates } from "./progress";
import { Money } from "./components";
function forecast() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return dateKey(d);
}
export function SubscriptionsScreen() {
  const s = useStore(),
    nav = useNav(),
    [active, setActive] = useState("ACTIVE");
  return (
    <Page
      title="Subscriptions"
      trailing={
        <IconButton
          icon="add"
          label="New subscription"
          onPress={() => nav.navigate("PlanEdit", { kind: "subscriptions" })}
        />
      }
    >
      <Chips
        values={["ACTIVE", "INACTIVE"]}
        labels={{ ACTIVE: "Active", INACTIVE: "Paused" }}
        value={active}
        onChange={setActive}
      />
      <Card>
        {s.subscriptions
          .filter((x) => !!x.is_active === (active === "ACTIVE"))
          .map((r) => {
            const next = subscriptionDates(r, forecast()).find(
              (d) =>
                !s.subscriptionPayments.some(
                  (p) => p.subscription_id === r.id && p.occurrence_date === d,
                ),
            );
            return (
              <MenuRow
                key={r.id}
                title={r.title}
                value={
                  !r.is_active
                    ? "Paused"
                    : (next ??
                      (r.end_date && r.end_date < dateKey()
                        ? "Ended"
                        : "No due payment"))
                }
                icon="repeat-outline"
                trailing={<Money minor={r.amount_minor} />}
                onPress={() =>
                  nav.navigate("SubscriptionDetails", { id: r.id })
                }
              />
            );
          })}
        {!s.subscriptions.filter((x) => !!x.is_active === (active === "ACTIVE"))
          .length && <Label muted>No subscriptions</Label>}
      </Card>
    </Page>
  );
}
export function SubscriptionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav(),
    router = useRouter(),
    t = useTheme();
  const r = s.subscriptions.find((r) => r.id === id),
    [tab, setTab] = useState("UPCOMING");
  if (!r)
    return (
      <Page title="Subscription unavailable">
        <Label>No record</Label>
      </Page>
    );
  const dates = subscriptionDates(r, forecast()),
    unpaid = dates.filter(
      (d) =>
        !s.subscriptionPayments.some(
          (p) => p.subscription_id === id && p.occurrence_date === d,
        ),
    );
  return (
    <Page
      title={r.title}
      trailing={
        <IconButton
          icon="options-outline"
          label="Subscription settings"
          onPress={() =>
            nav.navigate("PlanEdit", { kind: "subscriptions", id })
          }
        />
      }
    >
      <View style={{ alignItems: "center", paddingVertical: 16, gap: 12 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent + "18",
          }}
        >
          <Ionicons name="repeat-outline" size={36} color={t.accent} />
        </View>
        <Money minor={r.amount_minor} large />
        <Label muted>
          Every {r.interval_count} {r.interval_unit.toLowerCase()} ·{" "}
          {r.is_active
            ? r.end_date && r.end_date < dateKey()
              ? "Ended"
              : "Active"
            : "Paused"}
        </Label>
        {r.end_date && <Label muted>Ends {r.end_date}</Label>}
      </View>
      <Card>
        <MenuRow
          title="Amount"
          icon="cash-outline"
          onPress={() =>
            openField(router, "plan", "amount_minor", id, "subscriptions")
          }
        />
        <MenuRow
          title="Billing cycle"
          icon="repeat-outline"
          onPress={() =>
            openField(router, "plan", "interval_unit", id, "subscriptions")
          }
        />
      </Card>
      <Chips
        values={["UPCOMING", "PAID"]}
        labels={{ UPCOMING: "Renewals", PAID: "Paid" }}
        value={tab}
        onChange={setTab}
      />
      <Card>
        {tab === "UPCOMING"
          ? unpaid.slice(0, 12).map((d) => (
              <MenuRow
                key={d}
                title={d}
                value={d < dateKey() ? "Overdue" : undefined}
                icon="calendar-outline"
                trailing={<Money minor={r.amount_minor} />}
                onPress={() =>
                  router.push({
                    pathname: "/record-payment",
                    params: { kind: "SUBSCRIPTION", id, date: d },
                  })
                }
              />
            ))
          : s.subscriptionPayments
              .filter((p) => p.subscription_id === id)
              .map((p) => (
                <MenuRow
                  key={p.occurrence_date}
                  title={p.occurrence_date}
                  icon="checkmark-circle-outline"
                  onPress={() =>
                    nav.navigate("TransactionDetails", { id: p.transaction_id })
                  }
                />
              ))}
      </Card>
    </Page>
  );
}
