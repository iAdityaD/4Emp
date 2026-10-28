import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";
import { currency } from "../../domain/finance";
import { dateKey } from "../../domain/shift";
import { PlanningRepository } from "../../repositories/PlanningRepository";
import { useStore } from "../../state/store";
import { act, Button, Card, Edit, Label, Page, Row } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { AccountChoice, Money, Progress } from "./components";
import { PlanList } from "./screenKit";
export function LoansScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <PlanList
      kind="loans"
      title="Loans & EMIs"
      description="A clear view of principal, interest and what remains."
      rows={s.loans.map((l) => {
        const paid = s.emis.filter(
            (e) => e.loan_id === l.id && e.status === "PAID",
          ),
          principal = paid.reduce((n, e) => n + e.principal_minor, 0);
        return {
          id: l.id,
          title: l.title,
          amount: l.emi_minor,
          subtitle: `${paid.length}/${s.emis.filter((e) => e.loan_id === l.id).length} paid · ${(l.annual_rate_bps / 100).toFixed(2)}% p.a. · ${l.is_active ? "Active" : "Archived"}`,
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
    nav = useNav();
  const l = s.loans.find((x) => x.id === id);
  const [account, setAccount] = useState(l?.account_id ?? "");
  if (!l)
    return (
      <Page title="Loan unavailable">
        <Label>No record.</Label>
      </Page>
    );
  const entries = s.emis
    .filter((e) => e.loan_id === id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paid = entries.filter((e) => e.status === "PAID"),
    principal = paid.reduce((n, e) => n + e.principal_minor, 0);
  return (
    <Page
      title={l.title}
      subtitle="Reducing-balance schedule. Payments debit your chosen account."
    >
      <Card>
        <Label muted>Remaining principal</Label>
        <Money minor={l.principal_minor - principal} large />
        <Progress value={principal / l.principal_minor} />
        <Row>
          <Label>
            {paid.length} / {entries.length} paid
          </Label>
          <Edit
            onPress={() => nav.navigate("PlanEdit", { kind: "loans", id })}
          />
        </Row>
        <Label muted>Interest paid</Label>
        <Money minor={paid.reduce((n, e) => n + e.interest_minor, 0)} />
        <Label muted>Pay using</Label>
        <AccountChoice value={account} onChange={setAccount} />
      </Card>
      {entries.map((e) => (
        <Card key={e.id}>
          <Row>
            <Label weight>{e.due_date}</Label>
            <Money minor={e.amount_minor} />
          </Row>
          <Label muted size={12}>
            Principal {currency(e.principal_minor / 100, s.settings.currency)} ·
            Interest {currency(e.interest_minor / 100, s.settings.currency)}
          </Label>
          {e.status === "PAID" ? (
            <Button
              secondary
              title="View / reverse payment"
              onPress={() =>
                nav.navigate("TransactionDetails", { id: e.transaction_id! })
              }
            />
          ) : (
            <Button
              title={
                e.due_date < dateKey() ? "Pay overdue EMI" : "Record payment"
              }
              disabled={!l.is_active}
              onPress={() =>
                Alert.alert(
                  "Record EMI payment?",
                  `Debit ${currency(e.amount_minor / 100, s.settings.currency)} from ${s.accounts.find((a) => a.id === account)?.name}?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Record",
                      onPress: () =>
                        void act(() =>
                          PlanningRepository.payEMI(e.id, account),
                        ),
                    },
                  ],
                )
              }
            />
          )}
        </Card>
      ))}
    </Page>
  );
}
