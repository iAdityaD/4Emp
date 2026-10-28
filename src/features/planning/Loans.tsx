import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { currency, cycle } from "../../domain/finance";
import { dateKey } from "../../domain/shift";
import { CommitmentRepository } from "../../repositories/CommitmentRepository";
import { PlanningRepository } from "../../repositories/PlanningRepository";
import { TransactionRepository } from "../../repositories/TransactionRepository";
import { useStore } from "../../state/store";
import { Button, Card, Chips, Label, Page, Row, act } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { ProgressOrbit } from "../design/charts";
import { IconButton, MenuRow, Section } from "../design/primitives";
import { openField } from "../editor/Screens";
import { AccountChoice, Money } from "./components";
import { PlanList } from "./screenKit";
export function LoansScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <PlanList
      kind="loans"
      title="Loans & EMIs"
      description="Principal and interest are tracked separately."
      rows={s.loans.map((l) => {
        const paid = s.emis.filter(
            (e) => e.loan_id === l.id && e.status === "PAID",
          ),
          principal = paid.reduce((n, e) => n + e.principal_minor, 0);
        return {
          id: l.id,
          title: l.title,
          amount: l.emi_minor,
          subtitle: `${paid.length} paid · ${(l.annual_rate_bps / 100).toFixed(2)}%`,
          progress: principal / l.principal_minor,
          detail: () => nav.navigate("LoanDetails", { id: l.id }),
        };
      })}
    />
  );
}
export function LoanDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav(),
    router = useRouter(),
    [tab, setTab] = useState("DUE");
  const l = s.loans.find((x) => x.id === id);
  if (!l)
    return (
      <Page title="Loan unavailable">
        <Label>No record</Label>
      </Page>
    );
  const entries = s.emis
      .filter((e) => e.loan_id === id)
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    paid = entries.filter((e) => e.status === "PAID"),
    principal = paid.reduce((n, e) => n + e.principal_minor, 0),
    rows = entries.filter((e) =>
      tab === "DUE" ? e.status === "PENDING" : e.status === "PAID",
    );
  return (
    <Page
      title={l.title}
      trailing={
        <IconButton
          icon="options-outline"
          label="Loan settings"
          onPress={() => nav.navigate("PlanEdit", { kind: "loans", id })}
        />
      }
    >
      <Card>
        <Row>
          <ProgressOrbit value={principal / l.principal_minor} size={115} />
          <View style={{ flex: 1, gap: 8 }}>
            <Label muted size={11}>
              Remaining principal
            </Label>
            <Money minor={l.principal_minor - principal} large />
            <Label muted size={11}>
              {paid.length} / {entries.length} paid
            </Label>
          </View>
        </Row>
      </Card>
      <Card>
        <MenuRow
          title="Monthly EMI"
          icon="cash-outline"
          value={currency(l.emi_minor / 100, s.settings.currency)}
          onPress={() => openField(router, "plan", "emi_minor", id, "loans")}
        />
        <MenuRow
          title="Annual interest"
          icon="trending-up-outline"
          value={`${l.annual_rate_bps / 100}%`}
          onPress={() =>
            openField(router, "plan", "annual_rate_bps", id, "loans")
          }
        />
      </Card>
      <Chips
        values={["DUE", "PAID"]}
        labels={{ DUE: "Due", PAID: "Paid" }}
        value={tab}
        onChange={setTab}
      />
      <Card>
        {rows.map((e) => (
          <MenuRow
            key={e.id}
            title={e.due_date}
            value={`${currency(e.principal_minor / 100, s.settings.currency)} principal · ${currency(e.interest_minor / 100, s.settings.currency)} interest`}
            icon={
              e.status === "PAID"
                ? "checkmark-circle-outline"
                : e.due_date < dateKey()
                  ? "alert-circle-outline"
                  : "calendar-outline"
            }
            trailing={<Money minor={e.amount_minor} />}
            onPress={() =>
              e.status === "PAID"
                ? nav.navigate("TransactionDetails", { id: e.transaction_id! })
                : router.push({
                    pathname: "/record-payment",
                    params: { kind: "EMI", id: e.id },
                  })
            }
          />
        ))}
        {!rows.length && <Label muted>No payments here</Label>}
      </Card>
    </Page>
  );
}
export function RecordPaymentScreen() {
  const { kind, id, date } = useLocalSearchParams<{
      kind: "EMI" | "SUBSCRIPTION" | "CLAIM" | "BILL";
      id: string;
      date?: string;
    }>(),
    s = useStore(),
    nav = useNav();
  const claim = s.transactions.find((t) => t.id === id),
    bill = s.commitments.find((c) => c.id === id);
  const emi = s.emis.find((e) => e.id === id),
    loan = s.loans.find((l) => l.id === emi?.loan_id),
    sub = s.subscriptions.find((x) => x.id === id),
    title =
      kind === "CLAIM"
        ? claim?.note || "Claim"
        : kind === "BILL"
          ? bill?.title
          : kind === "EMI"
            ? loan?.title
            : sub?.title,
    amount =
      kind === "CLAIM"
        ? claim?.amount_minor
        : kind === "BILL"
          ? bill
            ? Math.round(bill.amount * 100)
            : undefined
          : kind === "EMI"
            ? emi?.amount_minor
            : sub?.amount_minor;
  const [account, setAccount] = useState(
    (kind === "BILL"
      ? bill?.account_id
      : kind === "EMI"
        ? loan?.account_id
        : sub?.account_id) ??
      s.accounts[0]?.id ??
      "",
  );
  if (!title || amount === undefined)
    return (
      <Page title="Payment unavailable">
        <Label>No due item</Label>
      </Page>
    );
  return (
    <Page title={kind === "CLAIM" ? "Settle claim" : "Record payment"}>
      <View style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
        <Label muted>{title}</Label>
        <Money minor={amount} large />
        <Label muted size={12}>
          {kind === "EMI" ? emi?.due_date : date}
        </Label>
      </View>
      <Section title={kind === "CLAIM" ? "Credit to" : "Pay from"} />
      <AccountChoice value={account} onChange={setAccount} />
      <Button
        title={kind === "CLAIM" ? "Mark settled" : "Record payment"}
        icon="checkmark"
        onPress={() =>
          void act(
            () =>
              kind === "CLAIM"
                ? TransactionRepository.settle(id, account)
                : kind === "BILL"
                  ? CommitmentRepository.pay(
                      { ...bill!, account_id: account },
                      cycle(new Date(), s.settings.cycleDay).key,
                    )
                  : kind === "EMI"
                    ? PlanningRepository.payEMI(id, account)
                    : PlanningRepository.paySubscription(id, date!, account),
            () => nav.goBack(),
          )
        }
      />
    </Page>
  );
}
