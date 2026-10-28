import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { parseAmount } from "../../domain/finance";
import { Transaction } from "../../domain/models";
import { TransactionRepository } from "../../repositories/TransactionRepository";
import { useEntryOptions } from "../../state/entryOptions";
import { useStore } from "../../state/store";
import {
  act,
  Button,
  Card,
  Chips,
  Label,
  Page,
  Row,
  useTheme,
} from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton, MenuRow } from "../design/primitives";
import { fieldsFor, formatField, recordFor } from "../editor/model";
import { openField } from "../editor/Screens";
import { AccountChoice } from "../planning/components";
export function EntryScreen() {
  const p = useLocalSearchParams<{ type?: Transaction["type"] }>(),
    s = useStore(),
    nav = useNav(),
    t = useTheme(),
    router = useRouter(),
    options = useEntryOptions();
  useEffect(() => {
    useEntryOptions.getState().reset(initial);
  }, []);
  const initial = ["EXPENSE", "INCOME", "TRANSFER"].includes(p.type ?? "")
    ? p.type!
    : "EXPENSE";
  const [type, setType] = useState<Transaction["type"]>(initial),
    [amount, setAmount] = useState(""),
    [account, setAccount] = useState(s.accounts[0]?.id ?? ""),
    [destination, setDestination] = useState(s.accounts[1]?.id ?? ""),
    [category, setCategory] = useState(
      s.categories.find(
        (c) => c.is_active && (c.kind === initial || c.kind === "BOTH"),
      )?.id ?? "",
    );
  const list = s.categories.filter(
    (c) => c.is_active && (c.kind === type || c.kind === "BOTH"),
  );
  const append = (key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount((v) =>
      key === "back"
        ? v.slice(0, -1)
        : key === "."
          ? v.includes(".")
            ? v
            : (v || "0") + "."
          : v.length > 13 || (v.includes(".") && v.split(".")[1]!.length >= 2)
            ? v
            : v === "0"
              ? key
              : v + key,
    );
  };
  const save = () =>
    void act(
      () =>
        TransactionRepository.create({
          type,
          accountId: account,
          destinationId: type === "TRANSFER" ? destination : undefined,
          amount: parseAmount(amount),
          categoryId: type === "TRANSFER" ? undefined : category || undefined,
          date: options.transaction_date,
          note: String(options.note ?? ""),
          tags: String(options.tags ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          reimbursable: type === "EXPENSE" && !!options.is_reimbursable,
        }),
      () => nav.goBack(),
    );
  if (!s.accounts.length)
    return (
      <Page
        title="New entry"
        trailing={
          <IconButton
            icon="ellipsis-horizontal"
            label="Entry details"
            onPress={() => router.push("/entry-details")}
          />
        }
      >
        <Button title="Add account" onPress={() => nav.navigate("Accounts")} />
      </Page>
    );
  return (
    <Page
      title="New entry"
      trailing={
        <IconButton
          icon="ellipsis-horizontal"
          label="Entry details"
          onPress={() => router.push("/entry-details")}
        />
      }
    >
      <Chips
        values={["EXPENSE", "INCOME", "TRANSFER"] as const}
        labels={{ EXPENSE: "Expense", INCOME: "Income", TRANSFER: "Transfer" }}
        value={type}
        onChange={(v) => {
          setType(v);
          useEntryOptions.getState().setField("type", v);
          setCategory(
            s.categories.find(
              (c) => c.is_active && (c.kind === v || c.kind === "BOTH"),
            )?.id ?? "",
          );
        }}
      />
      <Row>
        <View style={{ flex: 1 }}>
          <Label muted size={12}>
            {s.settings.currency}
          </Label>
          <Label size={40} weight>
            {amount || "0"}
          </Label>
        </View>
        <IconButton
          icon="ellipse"
          label="Decimal point"
          onPress={() => append(".")}
        />
      </Row>
      <AccountChoice
        value={account}
        onChange={(v) => {
          setAccount(v);
          if (v === destination)
            setDestination(s.accounts.find((a) => a.id !== v)?.id ?? "");
        }}
      />
      {type === "TRANSFER" ? (
        <Card>
          <Label muted size={11}>
            To
          </Label>
          <AccountChoice value={destination} onChange={setDestination} />
        </Card>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Array.from({ length: Math.ceil(list.length / 2) }, (_, column) => (
              <View key={column} style={{ gap: 8 }}>
                {list.slice(column * 2, column * 2 + 2).map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityLabel={`Category ${c.name}`}
                    onPress={() => setCategory(c.id)}
                    style={{
                      width: 78,
                      padding: 9,
                      alignItems: "center",
                      gap: 5,
                      borderRadius: 15,
                      backgroundColor:
                        category === c.id ? c.color_hex + "20" : "transparent",
                    }}
                  >
                    <Ionicons
                      name={
                        c.icon_name as React.ComponentProps<
                          typeof Ionicons
                        >["name"]
                      }
                      size={23}
                      color={category === c.id ? c.color_hex : t.muted}
                    />
                    <Label size={10}>{c.name}</Label>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "save"].map(
          (k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={
                k === "save" ? "Save entry" : k === "back" ? "Backspace" : k
              }
              disabled={s.busy || (k === "save" && !amount)}
              onPress={() => (k === "save" ? save() : append(k))}
              style={({ pressed }) => ({
                width: "31%",
                height: 54,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: k === "save" ? t.accent : t.card,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {k === "back" || k === "save" ? (
                <Ionicons
                  name={k === "back" ? "backspace-outline" : "checkmark"}
                  size={25}
                  color={k === "save" ? t.onAccent : t.text}
                />
              ) : (
                <Label size={25} weight>
                  {k}
                </Label>
              )}
            </Pressable>
          ),
        )}
      </View>
    </Page>
  );
}

export function EntryOptionsScreen() {
  const options = useEntryOptions(),
    router = useRouter();
  const record = recordFor("entry")!;
  return (
    <Page title="Entry details">
      <Card>
        {fieldsFor("entry")
          .filter(
            (f) => f.key !== "is_reimbursable" || options.type === "EXPENSE",
          )
          .map((f) => (
            <MenuRow
              key={f.key}
              title={f.label}
              value={formatField(f, record[f.key])}
              icon={f.icon}
              onPress={() => openField(router, "entry", f.key)}
            />
          ))}
      </Card>
    </Page>
  );
}
