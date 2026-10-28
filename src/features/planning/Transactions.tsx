import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { parseAmount } from "../../domain/finance";
import { Transaction } from "../../domain/models";
import { dateKey, formTime } from "../../domain/shift";
import { TransactionRepository } from "../../repositories/TransactionRepository";
import { useStore } from "../../state/store";
import {
  act,
  Button,
  Card,
  Chips,
  Field,
  Label,
  Page,
  Row,
  useTheme,
} from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { AccountChoice, CategoryChoice, Money, Toggle } from "./components";
import { Empty, MonthPicker } from "./screenKit";
export function AdvancedTransactionsScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme();
  const [type, setType] = useState("ALL"),
    [search, setSearch] = useState(""),
    [account, setAccount] = useState(""),
    [month, setMonth] = useState(dateKey().slice(0, 7)),
    [allDates, setAllDates] = useState(false);
  const rows = s.transactions.filter(
    (x) =>
      (type === "ALL" || x.type === type) &&
      (!account ||
        x.account_id === account ||
        x.destination_account_id === account) &&
      (allDates || dateKey(Date.parse(x.transaction_date)).startsWith(month)) &&
      `${x.note ?? ""} ${s.categories.find((c) => c.id === x.category_id)?.name ?? ""} ${x.tags}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Page title="Transactions" scroll={false}>
      <Row>
        <Button title="＋ Entry" onPress={() => nav.navigate("QuickEntry")} />
        <Button
          title="Transfer"
          secondary
          onPress={() => nav.navigate("Transfer")}
        />
      </Row>
      <Field
        label="Search notes, tags or category"
        value={search}
        onChange={setSearch}
      />
      <Chips
        values={["ALL", "INCOME", "EXPENSE", "TRANSFER"]}
        value={type}
        onChange={setType}
      />
      <Chips
        values={["", ...s.accounts.map((a) => a.id)]}
        labels={{
          "": "All accounts",
          ...Object.fromEntries(s.accounts.map((a) => [a.id, a.name])),
        }}
        value={account}
        onChange={setAccount}
      />
      <Row>
        <Button
          title={allDates ? "All dates" : "Choose all dates"}
          secondary
          onPress={() => setAllDates((v) => !v)}
        />
        <Label muted>{rows.length} entries</Label>
      </Row>
      {!allDates && <MonthPicker month={month} onChange={setMonth} />}
      <View style={{ flex: 1, minHeight: 120 }}>
        <FlashList
          data={rows}
          estimatedItemSize={83}
          keyExtractor={(x) => x.id}
          ListEmptyComponent={
            <Empty text="No matching entries. Record your first transaction or change the filters." />
          }
          renderItem={({ item: x }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.navigate("TransactionDetails", { id: x.id })}
              style={{
                paddingVertical: 14,
                borderBottomColor: t.line,
                borderBottomWidth: 1,
              }}
            >
              <Row>
                <View style={{ flex: 1 }}>
                  <Label weight>
                    {x.note ||
                      s.categories.find((c) => c.id === x.category_id)?.name ||
                      x.type}
                  </Label>
                  <Label muted size={11}>
                    {dateKey(Date.parse(x.transaction_date))} ·{" "}
                    {s.accounts.find((a) => a.id === x.account_id)?.name}
                    {x.type === "TRANSFER"
                      ? " → " +
                        s.accounts.find(
                          (a) => a.id === x.destination_account_id,
                        )?.name
                      : ""}
                  </Label>
                </View>
                <Money
                  minor={x.type === "INCOME" ? x.amount_minor : -x.amount_minor}
                  color={
                    x.type === "INCOME"
                      ? t.success
                      : x.type === "TRANSFER"
                        ? t.cyan
                        : t.danger
                  }
                />
              </Row>
            </Pressable>
          )}
        />
      </View>
    </Page>
  );
}
export function TransactionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav();
  const tx = s.transactions.find((x) => x.id === id);
  const [amount, setAmount] = useState(String(tx?.amount ?? "")),
    [account, setAccount] = useState(tx?.account_id ?? ""),
    [destination, setDestination] = useState(tx?.destination_account_id ?? ""),
    [category, setCategory] = useState(tx?.category_id ?? ""),
    [type, setType] = useState<Transaction["type"]>(tx?.type ?? "EXPENSE"),
    [note, setNote] = useState(tx?.note ?? ""),
    [date, setDate] = useState(tx ? formTime(tx.transaction_date) : ""),
    [tags, setTags] = useState(
      tx ? (JSON.parse(tx.tags) as string[]).join(", ") : "",
    ),
    [reimb, setReimb] = useState(!!tx?.is_reimbursable);
  if (!tx)
    return (
      <Page title="Entry unavailable">
        <Label>This entry has been reversed.</Label>
      </Page>
    );
  const editable =
    tx.ledger_kind === "PERSONAL" &&
    tx.reimbursement_status !== "SETTLED" &&
    !tx.is_split &&
    !s.contributions.some((c) => c.transaction_id === tx.id);
  return (
    <Page
      title="Transaction details"
      subtitle={
        editable
          ? "Edit a record. Balances and analytics update together."
          : "A linked or settled record. Reverse it to undo its financial effect."
      }
    >
      <Card>
        <Money minor={tx.amount_minor} large />
        <Label>
          {tx.ledger_kind} · {tx.reimbursement_status.replaceAll("_", " ")}
        </Label>
        {editable && (
          <>
            <Chips
              values={["EXPENSE", "INCOME", "TRANSFER"] as const}
              value={type}
              onChange={(v) => {
                setType(v);
                setCategory("");
              }}
            />
            <Field label="Amount" value={amount} onChange={setAmount} numeric />
            <Label muted>Account</Label>
            <AccountChoice value={account} onChange={setAccount} />
            {type === "TRANSFER" ? (
              <>
                <Label muted>Destination</Label>
                <AccountChoice value={destination} onChange={setDestination} />
              </>
            ) : (
              <CategoryChoice
                kind={type}
                value={category}
                onChange={setCategory}
              />
            )}
            <Field
              label="Date and time · YYYY-MM-DDTHH:mm"
              value={date}
              onChange={setDate}
            />
            <Field label="Note" value={note} onChange={setNote} />
            <Field
              label="Tags (comma-separated)"
              value={tags}
              onChange={setTags}
            />
            {type === "EXPENSE" && (
              <Toggle
                label="Employer reimbursable"
                value={reimb}
                onChange={setReimb}
              />
            )}
            <Button
              title="Save changes"
              onPress={() =>
                void act(
                  () =>
                    TransactionRepository.edit(id, {
                      accountId: account,
                      destinationId: destination,
                      type,
                      amount: parseAmount(amount),
                      categoryId:
                        type === "TRANSFER" ? undefined : category || undefined,
                      date,
                      note,
                      tags: tags
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                      reimbursable: type === "EXPENSE" && reimb,
                    }),
                  () => nav.goBack(),
                )
              }
            />
          </>
        )}
        <Button
          secondary
          title="Delete / reverse entry"
          onPress={() =>
            Alert.alert(
              "Reverse this entry?",
              "Its balance effect is removed. A linked EMI or subscription becomes unpaid. Recurring identities stay recorded to prevent automatic reposting. Archived accounts affected by the reversal are reopened so their balances stay visible.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reverse",
                  style: "destructive",
                  onPress: () =>
                    void act(
                      () => TransactionRepository.remove(id),
                      () => nav.goBack(),
                    ),
                },
              ],
            )
          }
        />
      </Card>
    </Page>
  );
}
