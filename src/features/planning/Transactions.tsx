import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { dateKey } from "../../domain/shift";
import { TransactionRepository } from "../../repositories/TransactionRepository";
import { useActivityFilters } from "../../state/activity";
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
import { IconButton, InfoButton, MenuRow, Section } from "../design/primitives";
import { openField } from "../editor/Screens";
import { formatField, recordFor, transactionFields } from "../editor/model";
import { Money, Toggle } from "./components";
import { Empty, monthName, MonthPicker } from "./screenKit";
export function AdvancedTransactionsScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme(),
    router = useRouter();
  const [type, setType] = useState("ALL"),
    [search, setSearch] = useState(""),
    [searching, setSearching] = useState(false);
  const filters = useActivityFilters();
  const rows = s.transactions.filter(
    (x) =>
      (type === "ALL" || x.type === type) &&
      (!filters.account ||
        x.account_id === filters.account ||
        x.destination_account_id === filters.account) &&
      (filters.allDates ||
        dateKey(Date.parse(x.transaction_date)).startsWith(filters.month)) &&
      `${x.note ?? ""} ${s.categories.find((c) => c.id === x.category_id)?.name ?? ""} ${x.tags}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Page
      title="Activity"
      scroll={false}
      trailing={
        <View style={{ flexDirection: "row", gap: 6 }}>
          <IconButton
            icon="search-outline"
            label="Search transactions"
            onPress={() => {
              setSearching((x) => !x);
              if (searching) setSearch("");
            }}
          />
          <IconButton
            icon="options-outline"
            label="Filter transactions"
            onPress={() => router.push("/activity-filters")}
          />
          <IconButton
            icon="add"
            label="New entry"
            filled
            onPress={() => nav.navigate("QuickEntry")}
          />
        </View>
      }
    >
      {searching && (
        <Field label="Search" value={search} onChange={setSearch} />
      )}
      <Chips
        values={["ALL", "EXPENSE", "INCOME", "TRANSFER"]}
        labels={{
          ALL: "All",
          EXPENSE: "Expenses",
          INCOME: "Income",
          TRANSFER: "Transfers",
        }}
        value={type}
        onChange={setType}
      />
      <Row>
        <Label muted size={12}>
          {filters.allDates ? "All dates" : monthName(filters.month)}
          {filters.account
            ? " · " +
              [...s.accounts, ...s.archivedAccounts].find(
                (a) => a.id === filters.account,
              )?.name
            : ""}
        </Label>
        <Label muted size={11}>
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </Label>
      </Row>
      <View style={{ flex: 1, minHeight: 100 }}>
        <FlashList
          data={rows}
          estimatedItemSize={83}
          keyExtractor={(x) => x.id}
          ListEmptyComponent={<Empty text="No entries" />}
          renderItem={({ item: x }) => {
            const category = s.categories.find((c) => c.id === x.category_id),
              color =
                x.type === "INCOME"
                  ? t.success
                  : x.type === "TRANSFER"
                    ? t.cyan
                    : (category?.color_hex ?? t.danger);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.navigate("TransactionDetails", { id: x.id })}
                style={{
                  paddingVertical: 15,
                  borderBottomWidth: 1,
                  borderColor: t.line,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      backgroundColor: color + "18",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={
                        (x.type === "TRANSFER"
                          ? "swap-horizontal-outline"
                          : (category?.icon_name ??
                            (x.type === "INCOME"
                              ? "arrow-down-outline"
                              : "receipt-outline"))) as React.ComponentProps<
                          typeof Ionicons
                        >["name"]
                      }
                      size={21}
                      color={color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label weight>{x.note || category?.name || x.type}</Label>
                    <Label muted size={11}>
                      {new Date(x.transaction_date).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ·{" "}
                      {
                        [...s.accounts, ...s.archivedAccounts].find(
                          (a) => a.id === x.account_id,
                        )?.name
                      }
                    </Label>
                  </View>
                  <Money
                    minor={
                      x.type === "INCOME" ? x.amount_minor : -x.amount_minor
                    }
                    color={x.type === "INCOME" ? t.success : t.text}
                  />
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </Page>
  );
}
export function ActivityFiltersScreen() {
  const s = useStore(),
    filters = useActivityFilters(),
    router = useRouter();
  const [account, setAccount] = useState(filters.account),
    [month, setMonth] = useState(filters.month),
    [allDates, setAllDates] = useState(filters.allDates);
  return (
    <Page
      title="Filter activity"
      trailing={
        <IconButton
          icon="refresh-outline"
          label="Reset filters"
          onPress={() => {
            setAccount("");
            setMonth(dateKey().slice(0, 7));
            setAllDates(false);
          }}
        />
      }
    >
      <Card>
        <Toggle label="All dates" value={allDates} onChange={setAllDates} />
        {!allDates && <MonthPicker month={month} onChange={setMonth} />}
      </Card>
      <Section title="Account" />
      <Chips
        values={["", ...s.accounts.map((a) => a.id)]}
        labels={{
          "": "All accounts",
          ...Object.fromEntries(s.accounts.map((a) => [a.id, a.name])),
        }}
        value={account}
        onChange={setAccount}
      />
      <Button
        title="Apply"
        icon="checkmark"
        onPress={() => {
          filters.set({ account, month, allDates });
          router.back();
        }}
      />
    </Page>
  );
}
export function TransactionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    router = useRouter(),
    nav = useNav(),
    t = useTheme();
  const tx = s.transactions.find((x) => x.id === id);
  if (!tx)
    return (
      <Page title="Entry unavailable">
        <Label muted>Entry removed</Label>
      </Page>
    );
  const locked =
    tx.ledger_kind !== "PERSONAL" ||
    tx.reimbursement_status === "SETTLED" ||
    !!tx.is_split ||
    s.contributions.some((c) => c.transaction_id === id);
  const record = recordFor("transaction", id)!;
  const fields = transactionFields.filter(
    (f) =>
      (f.key !== "destination_account_id" || tx.type === "TRANSFER") &&
      (f.key !== "is_reimbursable" || tx.type === "EXPENSE") &&
      f.key !== "amount_minor",
  );
  return (
    <Page
      title="Transaction"
      trailing={
        <InfoButton
          title="Transaction"
          text={
            locked
              ? "This payment is linked. Reverse it to undo its effect."
              : "Tap a value to edit it. Reversing an entry removes its balance effect while keeping the audit record."
          }
        />
      }
    >
      <View style={{ alignItems: "center", gap: 12, paddingVertical: 18 }}>
        <View
          style={{
            backgroundColor:
              (tx.type === "INCOME" ? t.success : t.danger) + "18",
            padding: 20,
            borderRadius: 26,
          }}
        >
          <Ionicons
            name={
              tx.type === "TRANSFER"
                ? "swap-horizontal"
                : tx.type === "INCOME"
                  ? "arrow-down"
                  : "arrow-up"
            }
            size={30}
            color={tx.type === "INCOME" ? t.success : t.danger}
          />
        </View>
        <Pressable
          disabled={locked}
          accessibilityLabel="Edit amount"
          onPress={() => openField(router, "transaction", "amount_minor", id)}
        >
          <Money minor={tx.amount_minor} large />
        </Pressable>
        <Label muted size={12}>
          {tx.reimbursement_status === "PENDING"
            ? "Claim pending"
            : tx.ledger_kind === "COMMITMENT"
              ? "Bill payment"
              : tx.type.charAt(0) + tx.type.slice(1).toLowerCase()}
        </Label>
      </View>
      <Card>
        {fields.map((f) => (
          <MenuRow
            key={f.key}
            title={f.label}
            icon={f.icon}
            value={formatField(f, record[f.key])}
            onPress={() => {
              if (!locked) openField(router, "transaction", f.key, id);
            }}
            trailing={
              locked ? (
                <Ionicons
                  name="lock-closed-outline"
                  color={t.muted}
                  size={14}
                />
              ) : undefined
            }
          />
        ))}
      </Card>
      <Button
        title="Reverse entry"
        icon="trash-outline"
        secondary
        onPress={() =>
          Alert.alert(
            "Reverse entry?",
            "Its balance effect will be undone. Linked due items reopen.",
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
    </Page>
  );
}
