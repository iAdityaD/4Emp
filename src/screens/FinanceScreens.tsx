import { useRouter } from "expo-router";
import React, { useState } from "react";
import { cycle } from "../domain/finance";
import { IconButton, MenuRow } from "../features/design/primitives";
import { Money } from "../features/planning/components";
import { useStore } from "../state/store";
import { Card, Chips, Label, Page, Row } from "../ui/kit";
import { useNav } from "../ui/navigation";
export function ReimbursementsScreen() {
  const s = useStore(),
    nav = useNav(),
    router = useRouter(),
    [view, setView] = useState("PENDING");
  const rows = s.transactions.filter(
    (t) => t.is_reimbursable && t.reimbursement_status === view,
  );
  return (
    <Page title="Claims">
      <Chips
        values={["PENDING", "SETTLED"]}
        labels={{ PENDING: "Pending", SETTLED: "Settled" }}
        value={view}
        onChange={setView}
      />
      <Card>
        {rows.map((t) => (
          <MenuRow
            key={t.id}
            title={
              t.note ||
              s.categories.find((c) => c.id === t.category_id)?.name ||
              "Claim"
            }
            value={new Date(t.transaction_date).toLocaleDateString()}
            icon="business-outline"
            trailing={<Money minor={t.amount_minor} />}
            onPress={() => {
              if (view === "PENDING")
                router.push({
                  pathname: "/record-payment",
                  params: { kind: "CLAIM", id: t.id },
                });
              else {
                const credit = s.transactions.find(
                  (x) =>
                    x.linked_transaction_id === t.id &&
                    x.ledger_kind === "REIMBURSEMENT",
                );
                nav.navigate("TransactionDetails", { id: credit?.id ?? t.id });
              }
            }}
          />
        ))}
        {!rows.length && <Label muted>No claims here</Label>}
      </Card>
    </Page>
  );
}
export function CommitmentsScreen() {
  const s = useStore(),
    nav = useNav(),
    router = useRouter(),
    window = cycle(new Date(), s.settings.cycleDay);
  return (
    <Page
      title="Monthly bills"
      trailing={
        <IconButton
          icon="add"
          label="New monthly bill"
          onPress={() => router.push("/bill-edit")}
        />
      }
    >
      <Card>
        {s.commitments.map((c) => {
          const paid = s.payments.find(
            (p) => p.commitment_id === c.id && p.cycle === window.key,
          );
          return (
            <MenuRow
              key={c.id}
              title={c.title}
              value={`Day ${c.due_day_of_month} · ${paid ? "Paid" : "Due"}`}
              icon={paid ? "checkmark-circle-outline" : "receipt-outline"}
              trailing={
                <Row>
                  <Money minor={Math.round(c.amount * 100)} />
                  <IconButton
                    icon="options-outline"
                    label={`Edit ${c.title}`}
                    onPress={() =>
                      router.push({
                        pathname: "/bill-edit",
                        params: { id: c.id },
                      })
                    }
                  />
                </Row>
              }
              onPress={() =>
                paid
                  ? nav.navigate("TransactionDetails", {
                      id: paid.transaction_id,
                    })
                  : router.push({
                      pathname: "/record-payment",
                      params: { kind: "BILL", id: c.id },
                    })
              }
            />
          );
        })}
        {!s.commitments.length && <Label muted>No monthly bills</Label>}
      </Card>
    </Page>
  );
}
export function SplitScreen() {
  return (
    <Page title="Split with friends">
      <Card>
        <Label muted>Coming soon</Label>
      </Card>
    </Page>
  );
}
