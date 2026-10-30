import { transactionExpired } from "../../domain/transactionPolicy";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";
import { LendingRepository } from "../../repositories/LendingRepository";
import { useStore } from "../../state/store";
import { act, Button, Card, Chips, Label, Page, Row } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton, MenuRow } from "../design/primitives";
import { RecordSettingsScreen, StartSetup } from "../editor/Screens";
import { Money } from "./components";
import { Empty } from "./screenKit";
export function LendingScreen() {
  const s = useStore(),
    router = useRouter(),
    nav = useNav(),
    [tab, setTab] = useState("PENDING");
  const rows = s.lending
    .map((r) => ({
      ...r,
      paid: s.lendingRepayments
        .filter((p) => p.lending_id === r.id)
        .reduce((n, p) => n + p.amount_minor, 0),
    }))
    .filter((r) =>
      tab === "PENDING" ? r.paid < r.amount_minor : r.paid >= r.amount_minor,
    );
  return (
    <Page
      title="Lending"
      trailing={
        <IconButton
          icon="add"
          label="New lending"
          onPress={() => router.push("/lending-edit")}
        />
      }
    >
      <Chips
        values={["PENDING", "RETURNED"]}
        labels={{ PENDING: "Pending", RETURNED: "Returned" }}
        value={tab}
        onChange={setTab}
      />
      {!rows.length && <Empty text="No lending here" />}
      {rows.map((r) => (
        <Card key={r.id}>
          <MenuRow
            title={r.title}
            value={r.due_date ?? r.lent_date}
            icon="person-outline"
            trailing={<Money minor={r.amount_minor - r.paid} />}
            onPress={() => nav.navigate("LendingDetails", { id: r.id })}
          />
        </Card>
      ))}
    </Page>
  );
}
export function LendingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    router = useRouter(),
    nav = useNav();
  const r = s.lending.find((r) => r.id === id);
  if (!r)
    return (
      <Page title="Lending unavailable">
        <Label>No record</Label>
      </Page>
    );
  const rows = s.lendingRepayments
      .filter((p) => p.lending_id === id)
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
    paid = rows.reduce((n, p) => n + p.amount_minor, 0),
    remaining = r.amount_minor - paid;
  return (
    <Page
      title={r.title}
      trailing={
        <IconButton
          icon="create-outline"
          label="Lending settings"
          onPress={() =>
            router.push({ pathname: "/lending-edit", params: { id } })
          }
        />
      }
    >
      <Card>
        <Label muted>{remaining ? "Pending return" : "Returned"}</Label>
        <Money large minor={remaining} />
        <Row>
          <Label muted>Lent {r.lent_date}</Label>
          <Money minor={r.amount_minor} />
        </Row>
        {r.due_date && <Label muted>Expected {r.due_date}</Label>}
        {r.notes && <Label>{r.notes}</Label>}
        {remaining > 0 && (
          <Button
            title="Record repayment"
            icon="add"
            onPress={() =>
              router.push({ pathname: "/lending-repayment", params: { id } })
            }
          />
        )}
      </Card>
      <Label weight>Repayments</Label>
      {!rows.length && <Empty text="No repayments yet" />}
      {rows.map((p) => (
        <Card key={p.id}>
          <Row>
            <Label>{p.payment_date}</Label>
            <Money minor={p.amount_minor} />
          </Row>
          <Label muted>
            {s.accounts.find((a) => a.id === p.account_id)?.name ?? "Account"}
          </Label>
          {!transactionExpired(p.payment_date + "T00:00:00") && (
            <IconButton
              icon="arrow-undo-outline"
              label="Undo repayment"
              onPress={() =>
                Alert.alert(
                  "Undo repayment?",
                  "This reverses the linked balance entry.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Undo",
                      onPress: () =>
                        void act(() => LendingRepository.undoRepayment(p.id)),
                    },
                  ],
                )
              }
            />
          )}
        </Card>
      ))}
      {!transactionExpired(r.lent_date + "T00:00:00") && (
        <Button
          title="Delete lending"
          secondary
          icon="trash-outline"
          onPress={() =>
            Alert.alert(
              "Delete lending?",
              "The lending and all repayments will be reversed in your balances.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    void act(
                      () => LendingRepository.remove(id),
                      () => nav.goBack(),
                    ),
                },
              ],
            )
          }
        />
      )}
    </Page>
  );
}
export function LendingEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <RecordSettingsScreen entity="lending" id={id} />
  ) : (
    <StartSetup entity="lending" />
  );
}
export function LendingRepaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StartSetup entity="repayment" initial={{ lending_id: id }} />;
}
