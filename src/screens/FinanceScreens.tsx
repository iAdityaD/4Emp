import React, { useState } from "react";
import { View, Pressable, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import Svg, { Circle, G } from "react-native-svg";
import * as Haptics from "expo-haptics";
import {
  Page,
  Card,
  Row,
  Label,
  Button,
  Chips,
  Field,
  useTheme,
  act,
} from "../ui/kit";
import { useNav } from "../ui/navigation";
import { useStore } from "../state/store";
import {
  currency,
  parseAmount,
  cents,
  cycle,
  liquidity,
  runway,
  obligationDate,
  expenseShare,
} from "../domain/finance";
import { dateKey, formTime } from "../domain/shift";
import { Transaction, Commitment } from "../domain/models";
import { TransactionRepository } from "../repositories/TransactionRepository";
import { AccountRepository } from "../repositories/AccountRepository";
import { CommitmentRepository } from "../repositories/CommitmentRepository";
function AccountPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const accounts = useStore((s) => s.accounts),
    t = useTheme();
  return (
    <Row>
      {accounts.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => onChange(a.id)}
          style={{
            backgroundColor: value === a.id ? t.accent : t.line,
            padding: 12,
            borderRadius: 13,
          }}
        >
          <Label size={12} color={value === a.id ? t.bg : t.text}>
            {a.account_type === "CASH"
              ? "Cash"
              : a.account_type === "BANK_1"
                ? "Bank 1"
                : "Bank 2"}
          </Label>
        </Pressable>
      ))}
    </Row>
  );
}
function TransactionRow({ item }: { item: Transaction }) {
  const s = useStore(),
    t = useTheme();
  const a = s.accounts.find((x) => x.id === item.account_id);
  const category = s.categories.find((x) => x.id === item.category_id);
  return (
    <View
      style={{ paddingVertical: 13, borderBottomWidth: 1, borderColor: t.line }}
    >
      <Row>
        <View style={{ flex: 1 }}>
          <Label weight>{item.note || category?.name || item.type}</Label>
          <Label muted size={12}>
            {a?.name} · {new Date(item.transaction_date).toLocaleDateString()} ·{" "}
            {item.ledger_kind === "REIMBURSEMENT"
              ? "Settled"
              : item.reimbursement_status === "PENDING"
                ? "Receivable"
                : item.type}
          </Label>
        </View>
        <Label color={item.type === "INCOME" ? t.accent : t.text} weight>
          {item.type === "INCOME" ? "+" : "−"}
          {currency(item.amount, s.settings.currency)}
        </Label>
      </Row>
    </View>
  );
}
export function TransactionsScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <Page
      title="Ledger."
      subtitle="Every entry is yours. No bank connection."
      scroll={false}
    >
      <Row>
        <Button
          title="Add entry"
          icon="add"
          onPress={() => nav.navigate("QuickEntry")}
        />
        <Button
          secondary
          title="Transfer"
          onPress={() => nav.navigate("Transfer")}
        />
      </Row>
      <Row>
        <Button
          secondary
          title="Receivables"
          onPress={() => nav.navigate("Reimbursements")}
        />
        <Button
          secondary
          title="Accounts"
          onPress={() => nav.navigate("Rebalance")}
        />
      </Row>
      <View style={{ height: 450 }}>
        <FlashList
          data={s.transactions}
          estimatedItemSize={76}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => <TransactionRow item={item} />}
          ListEmptyComponent={
            <Card>
              <Label muted>
                No entries yet. Add an opening balance in Accounts.
              </Label>
            </Card>
          }
        />
      </View>
    </Page>
  );
}
export function QuickEntryScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme();
  const [account, setAccount] = useState(s.accounts[0]?.id ?? "bank1"),
    [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE"),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState("food"),
    [reimburse, setReimburse] = useState(false),
    [extra, setExtra] = useState(false),
    [note, setNote] = useState(""),
    [tags, setTags] = useState(""),
    [date, setDate] = useState(formTime(Date.now()));
  const append = (key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "⌫") setAmount((v) => v.slice(0, -1));
    else if (key === ".")
      setAmount((v) => (v.includes(".") ? v : (v || "0") + "."));
    else
      setAmount((v) =>
        v.length >= 13 || (v.includes(".") && v.split(".")[1]!.length >= 2)
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
          accountId: account,
          type,
          amount: parseAmount(amount),
          categoryId: type === "INCOME" ? "salary" : category,
          note,
          tags: tags
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          date,
          reimbursable: type === "EXPENSE" && reimburse,
        }),
      () => nav.goBack(),
    );
  return (
    <Page title="Quick entry" subtitle="A few taps. A clear ledger.">
      <Chips
        values={["EXPENSE", "INCOME"] as const}
        value={type}
        onChange={setType}
      />
      <Card>
        <Label size={38} weight>
          {s.settings.currency === "INR" ? "₹" : s.settings.currency}{" "}
          {amount || "0"}
        </Label>
        <Button secondary title="Decimal point" onPress={() => append(".")} />
        <AccountPicker value={account} onChange={setAccount} />
        {type === "EXPENSE" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {s.categories
              .filter((c) => c.id !== "salary")
              .slice(0, 8)
              .map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={{
                    width: "22%",
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor: category === c.id ? t.line : "transparent",
                    borderRadius: 12,
                  }}
                >
                  <Ionicons
                    name={
                      c.icon_name as React.ComponentProps<
                        typeof Ionicons
                      >["name"]
                    }
                    size={23}
                    color={category === c.id ? t.accent : t.muted}
                  />
                  <Label size={10}>{c.name}</Label>
                </Pressable>
              ))}
          </View>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Done"].map(
            (key) => (
              <Pressable
                key={key}
                accessibilityLabel={key === "⌫" ? "Backspace" : key}
                onPress={() => {
                  if (key === "Done") save();
                  else append(key);
                }}
                style={{
                  width: "31.8%",
                  height: 52,
                  backgroundColor: t.line,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Label size={23}>{key}</Label>
              </Pressable>
            ),
          )}
        </View>
        {type === "EXPENSE" && (
          <Pressable onPress={() => setReimburse((v) => !v)}>
            <Label>{reimburse ? "☑" : "☐"} Reimbursable by employer</Label>
          </Pressable>
        )}
        <Pressable onPress={() => nav.navigate("Split")}>
          <Label muted size={12}>
            Split with friends • Coming soon
          </Label>
        </Pressable>
        <Button
          secondary
          title={extra ? "Hide details" : "Notes, tags & date"}
          onPress={() => setExtra((v) => !v)}
        />
        {extra && (
          <>
            <Field label="Notes" value={note} onChange={setNote} />
            <Field
              label="Tags (comma-separated)"
              value={tags}
              onChange={setTags}
            />
            <Field
              label="Date & time (YYYY-MM-DDTHH:mm)"
              value={date}
              onChange={setDate}
            />
          </>
        )}
        <Button title="Done" onPress={save} disabled={!amount} />
      </Card>
    </Page>
  );
}
export function TransferScreen() {
  const s = useStore(),
    nav = useNav();
  const [from, setFrom] = useState("bank1"),
    [to, setTo] = useState("bank2"),
    [amount, setAmount] = useState("");
  return (
    <Page
      title="Move money"
      subtitle="Internal transfers are excluded from spending analytics."
    >
      <Card>
        <Label>From</Label>
        <AccountPicker value={from} onChange={setFrom} />
        <Label>To</Label>
        <AccountPicker value={to} onChange={setTo} />
        <Field label="Amount" value={amount} onChange={setAmount} numeric />
        <Button
          title="Transfer"
          disabled={from === to}
          onPress={() =>
            void act(
              () =>
                TransactionRepository.create({
                  accountId: from,
                  destinationId: to,
                  type: "TRANSFER",
                  amount: parseAmount(amount),
                }),
              () => nav.goBack(),
            )
          }
        />
      </Card>
    </Page>
  );
}
export function AnalyticsScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme();
  const current = cycle(new Date(), s.settings.cycleDay);
  const unpaid = s.commitments.filter(
    (c) =>
      !!obligationDate(c, current.start, current.end) &&
      !s.payments.some(
        (p) => p.commitment_id === c.id && p.cycle === current.key,
      ),
  );
  const balance = liquidity(s.accounts),
    fixed = unpaid.reduce((sum, c) => sum + cents(c.amount), 0) / 100,
    spend = runway(balance, fixed, current.days);
  const monthly = s.transactions.filter(
    (x) =>
      x.type === "EXPENSE" &&
      x.ledger_kind !== "ADJUSTMENT" &&
      !x.is_reimbursable &&
      dateKey(Date.parse(x.transaction_date)).slice(0, 7) ===
        dateKey().slice(0, 7),
  );
  const groups = s.categories
    .map((c) => ({
      ...c,
      total:
        monthly
          .filter((x) => x.category_id === c.id)
          .reduce((sum, x) => sum + cents(expenseShare(x)), 0) / 100,
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const sum = groups.reduce((n, g) => n + g.total, 0),
    circ = 2 * Math.PI * 64;
  let consumed = 0;
  const upcoming = unpaid.filter((c) => {
    const due = obligationDate(c, current.start, current.end)!;
    return due.getTime() - Date.now() <= 10 * 86400000;
  });
  return (
    <Page title="Financial clarity." subtitle="Manual money. Real visibility.">
      <Card>
        <Label muted>NET LIQUIDITY</Label>
        <Label size={34} weight>
          {currency(balance, s.settings.currency)}
        </Label>
        {s.accounts.map((a) => (
          <Row key={a.id}>
            <Label color={a.color_hex}>{a.name}</Label>
            <Label>{currency(a.current_balance, s.settings.currency)}</Label>
          </Row>
        ))}
      </Card>
      <Card>
        <Label muted>SAFE DAILY SPEND</Label>
        <Label size={30} color={spend.daily < 0 ? t.orange : t.accent} weight>
          {currency(spend.daily, s.settings.currency)} / day
        </Label>
        <Label muted>
          {current.days} days to next cycle •{" "}
          {currency(fixed, s.settings.currency)} reserved
        </Label>
        <Label size={12} muted>
          Receivables stay outside liquid balances until settled.
          {spend.reserve < 0 ? " Your obligations exceed liquid funds." : ""}
        </Label>
      </Card>
      <Row>
        <Label size={18} weight>
          Upcoming commitments
        </Label>
        <Button
          secondary
          title="Manage"
          onPress={() => nav.navigate("Commitments")}
        />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {upcoming.length ? (
          upcoming.map((c) => (
            <View key={c.id} style={{ width: 220, marginRight: 12 }}>
              <Card>
                <Label weight>{c.title}</Label>
                <Label>{currency(c.amount, s.settings.currency)}</Label>
                <Label muted>
                  {obligationDate(
                    c,
                    current.start,
                    current.end,
                  )!.toLocaleDateString()}
                </Label>
              </Card>
            </View>
          ))
        ) : (
          <Card>
            <Label muted>No unpaid obligations due in the next 10 days.</Label>
          </Card>
        )}
      </ScrollView>
      <Card>
        <Label weight>Monthly personal expenses</Label>
        <View style={{ alignItems: "center" }}>
          <Svg width={168} height={168}>
            <Circle
              cx={84}
              cy={84}
              r={64}
              stroke={t.line}
              strokeWidth={20}
              fill="none"
            />
            {groups.map((g) => {
              const fraction = g.total / (sum || 1),
                offset = consumed;
              consumed += fraction;
              return (
                <Circle
                  key={g.id}
                  cx={84}
                  cy={84}
                  r={64}
                  stroke={g.color_hex}
                  strokeWidth={20}
                  fill="none"
                  strokeDasharray={`${fraction * circ} ${circ}`}
                  strokeDashoffset={-offset * circ}
                  rotation={-90}
                  origin="84,84"
                />
              );
            })}
          </Svg>
          <Label size={22} weight>
            {currency(sum, s.settings.currency)}
          </Label>
        </View>
        {groups.map((g) => (
          <Row key={g.id}>
            <Label color={g.color_hex}>{g.name}</Label>
            <Label>{currency(g.total, s.settings.currency)}</Label>
          </Row>
        ))}
      </Card>
      {monthly.slice(0, 20).map((x) => (
        <TransactionRow key={x.id} item={x} />
      ))}
    </Page>
  );
}
export function ReimbursementsScreen() {
  const s = useStore(),
    t = useTheme();
  const [status, setStatus] = useState<"PENDING" | "SETTLED">("PENDING"),
    [account, setAccount] = useState("bank1");
  const list = s.transactions.filter(
      (x) => x.is_reimbursable && x.reimbursement_status === status,
    ),
    pending =
      s.transactions
        .filter((x) => x.reimbursement_status === "PENDING")
        .reduce((sum, x) => sum + cents(x.amount), 0) / 100,
    split =
      s.transactions
        .filter((x) => x.is_split)
        .reduce(
          (sum, x) =>
            sum +
            cents(
              (x.split_total_amount ?? x.amount) -
                (x.split_my_share ?? x.amount),
            ),
          0,
        ) / 100;
  return (
    <Page
      title="Receivables"
      subtitle="Awaiting reimbursement, not available to spend."
    >
      <Card>
        <Label muted>Employer pending</Label>
        <Label size={30} color={t.cyan}>
          {currency(pending, s.settings.currency)}
        </Label>
        <Label muted>
          Split receivables {currency(split, s.settings.currency)} (future-ready
          model)
        </Label>
      </Card>
      <Chips
        values={["PENDING", "SETTLED"] as const}
        value={status}
        onChange={setStatus}
      />
      {status === "PENDING" && (
        <>
          <Label muted>Settlement destination</Label>
          <AccountPicker value={account} onChange={setAccount} />
        </>
      )}
      {list.map((x) => (
        <Card key={x.id}>
          <TransactionRow item={x} />
          {status === "PENDING" && (
            <Button
              title="Mark settled"
              onPress={() =>
                Alert.alert(
                  "Confirm money received?",
                  `Credit ${currency(x.amount, s.settings.currency)} to the selected account?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Settle",
                      onPress: () =>
                        void act(() =>
                          TransactionRepository.settle(x.id, account),
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
export function CommitmentsScreen() {
  const s = useStore(),
    current = cycle(new Date(), s.settings.cycleDay);
  const [title, setTitle] = useState(""),
    [amount, setAmount] = useState(""),
    [day, setDay] = useState("1"),
    [account, setAccount] = useState("bank1"),
    [type, setType] = useState<Commitment["commitment_type"]>("EMI");
  return (
    <Page
      title="Fixed commitments"
      subtitle="Due days snap to month end. Paid once per cycle."
    >
      <Card>
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Amount" value={amount} onChange={setAmount} numeric />
        <Field label="Due day (1–31)" value={day} onChange={setDay} numeric />
        <AccountPicker value={account} onChange={setAccount} />
        <Chips
          values={["EMI", "SUBSCRIPTION", "RENT", "OTHER"] as const}
          value={type}
          onChange={setType}
        />
        <Button
          title="Add commitment"
          onPress={() =>
            void act(
              () =>
                CommitmentRepository.add({
                  title,
                  amount: parseAmount(amount),
                  due_day_of_month: Number(day),
                  account_id: account,
                  commitment_type: type,
                }),
              () => {
                setTitle("");
                setAmount("");
              },
            )
          }
        />
      </Card>
      {s.commitments.map((c) => {
        const paid = s.payments.some(
          (p) => p.commitment_id === c.id && p.cycle === current.key,
        );
        return (
          <Card key={c.id}>
            <Label weight>{c.title}</Label>
            <Label>
              {currency(c.amount, s.settings.currency)} • Day{" "}
              {c.due_day_of_month}
            </Label>
            <Row>
              <Button
                title={paid ? "Paid this cycle" : "Mark paid"}
                disabled={paid}
                onPress={() =>
                  Alert.alert(
                    "Record payment?",
                    "This debits the commitment account and records an expense.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Paid",
                        onPress: () =>
                          void act(() =>
                            CommitmentRepository.pay(c, current.key),
                          ),
                      },
                    ],
                  )
                }
              />
              <Button
                secondary
                title="Archive"
                onPress={() =>
                  void act(() => CommitmentRepository.remove(c.id))
                }
              />
            </Row>
          </Card>
        );
      })}
    </Page>
  );
}
export function RebalanceScreen() {
  const s = useStore();
  return (
    <Page
      title="Accounts & balances"
      subtitle="Corrections create audit entries, not personal income."
    >
      {s.accounts.map((a) => (
        <AccountForm
          key={a.id}
          id={a.id}
          name={a.name}
          balance={a.current_balance}
        />
      ))}
    </Page>
  );
}
function AccountForm({
  id,
  name,
  balance,
}: {
  id: string;
  name: string;
  balance: number;
}) {
  const [n, setN] = useState(name),
    [b, setB] = useState(String(balance));
  return (
    <Card>
      <Field label="Account name" value={n} onChange={setN} />
      <Field label="Current balance" value={b} onChange={setB} numeric />
      <Button
        secondary
        title="Save balance correction"
        onPress={() =>
          void act(() => AccountRepository.rebalance(id, n, Number(b)))
        }
      />
    </Card>
  );
}
export function SplitScreen() {
  return (
    <Page title="Split with friends" subtitle="Coming soon">
      <Card>
        <Label size={24}>Built to grow.</Label>
        <Label muted>
          The ledger already reserves group ID, total amount, personal share and
          split notes. Peer creation, collections and settlement are not enabled
          yet.
        </Label>
        <Label muted>
          Your current expenses remain fully manual. No contacts are uploaded.
        </Label>
      </Card>
    </Page>
  );
}
