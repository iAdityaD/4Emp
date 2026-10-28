import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { cents, currency, parseAmount } from "../../domain/finance";
import { dateKey } from "../../domain/shift";
import { PlanningRepository } from "../../repositories/PlanningRepository";
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
} from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { ProgressOrbit } from "../design/charts";
import { IconButton, InfoButton } from "../design/primitives";
import { AccountChoice, Money } from "./components";
import { Empty } from "./screenKit";
export function GoalsScreen() {
  const s = useStore(),
    nav = useNav();
  const [tab, setTab] = useState("ACTIVE");
  const rows = s.goals.filter((g) => {
    const total = s.contributions
      .filter((c) => c.goal_id === g.id)
      .reduce((n, c) => n + c.amount_minor, 0);
    return tab === "ARCHIVED"
      ? !g.is_active
      : !!g.is_active &&
          (tab === "COMPLETE"
            ? total >= g.target_minor
            : total < g.target_minor);
  });
  return (
    <Page
      title="Savings goals"
      trailing={
        <IconButton
          icon="add"
          label="New goal"
          onPress={() => nav.navigate("PlanEdit", { kind: "goals" })}
        />
      }
    >
      <Chips
        values={["ACTIVE", "COMPLETE", "ARCHIVED"]}
        value={tab}
        onChange={setTab}
      />
      {!rows.length && <Empty text="No goals here" />}
      {rows.map((g) => {
        const total = s.contributions
          .filter((c) => c.goal_id === g.id)
          .reduce((n, c) => n + c.amount_minor, 0);
        return (
          <Pressable
            key={g.id}
            onPress={() => nav.navigate("GoalDetails", { id: g.id })}
          >
            <Card>
              <Label weight>{g.title}</Label>
              <Money minor={total} />
              <Label muted>
                of {currency(g.target_minor / 100, s.settings.currency)}
                {g.deadline ? " · " + g.deadline : ""}
              </Label>
              <ProgressOrbit
                value={total / g.target_minor}
                color={g.color_hex}
              />
            </Card>
          </Pressable>
        );
      })}
    </Page>
  );
}
export function GoalDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav();
  const g = s.goals.find((g) => g.id === id);
  if (!g)
    return (
      <Page title="Goal unavailable">
        <Label>No record.</Label>
      </Page>
    );
  const rows = s.contributions
      .filter((c) => c.goal_id === id)
      .sort((a, b) => b.contribution_date.localeCompare(a.contribution_date)),
    total = rows.reduce((n, c) => n + c.amount_minor, 0);
  return (
    <Page
      title={g.title}
      subtitle={g.deadline ?? undefined}
      trailing={
        <IconButton
          icon="options-outline"
          label="Goal settings"
          onPress={() => nav.navigate("PlanEdit", { kind: "goals", id })}
        />
      }
    >
      <Card>
        <Money large minor={total} />
        <Label muted>
          Target {currency(g.target_minor / 100, s.settings.currency)}
        </Label>
        <ProgressOrbit value={total / g.target_minor} color={g.color_hex} />
        <Row>
          <Button
            title="Contribute"
            icon="add"
            disabled={!g.is_active}
            onPress={() => nav.navigate("Contribution", { id })}
          />
        </Row>
      </Card>
      <Label weight>Contributions</Label>
      {!rows.length && <Empty text="No contributions yet" />}
      {rows.map((c) => (
        <Card key={c.id}>
          <Row>
            <View>
              <Label>
                {s.accounts.find((a) => a.id === c.account_id)?.name ??
                  "Account"}
              </Label>
              <Label muted size={12}>
                {dateKey(Date.parse(c.contribution_date))} ·{" "}
                {c.note || "Goal allocation"}
              </Label>
            </View>
            <Money minor={c.amount_minor} />
          </Row>
          {c.transaction_id && (
            <Button
              secondary
              title="View linked transfer"
              onPress={() =>
                nav.navigate("TransactionDetails", { id: c.transaction_id! })
              }
            />
          )}
        </Card>
      ))}
    </Page>
  );
}
export function ContributionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav();
  const [account, setAccount] = useState(s.accounts[0]?.id ?? ""),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [type, setType] = useState("RESERVE");
  return (
    <Page
      title="Goal contribution"
      trailing={
        <InfoButton
          title="Goal contribution"
          text="Reserving earmarks money you already own. Releasing returns it to your available amount. An optional transfer moves it between accounts."
        />
      }
    >
      <Card>
        <Chips
          values={["RESERVE", "RELEASE"]}
          value={type}
          onChange={setType}
        />
        <Field label="Amount" value={amount} onChange={setAmount} numeric />
        <Label muted>
          {type === "RESERVE" ? "Source account" : "Account to release from"}
        </Label>
        <AccountChoice value={account} onChange={setAccount} />
        {type === "RESERVE" && (
          <>
            <Label muted>Optional transfer destination</Label>
            <AccountChoice value={to} onChange={setTo} optional />
          </>
        )}
        <Field label="Note" value={note} onChange={setNote} />
        <Button
          title={type === "RESERVE" ? "Reserve money" : "Release money"}
          onPress={() =>
            void act(
              () =>
                PlanningRepository.contribute(
                  id,
                  account,
                  cents(parseAmount(amount)) * (type === "RELEASE" ? -1 : 1),
                  note,
                  type === "RESERVE" ? to : undefined,
                ),
              () => nav.goBack(),
            )
          }
        />
      </Card>
    </Page>
  );
}
