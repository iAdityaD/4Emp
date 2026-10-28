import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Account } from "../../domain/models";
import { AccountRepository } from "../../repositories/AccountRepository";
import { useStore } from "../../state/store";
import { act, Button, Card, Chips, Field, Page } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { Money, Tile } from "./components";
export function AccountsScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <Page
      title="Accounts"
      subtitle="As many banks, wallets and cash accounts as you need."
    >
      <Button
        title="＋ Add account"
        onPress={() => nav.navigate("AccountEdit")}
      />
      {s.accounts.map((a) => (
        <Tile
          title={a.name}
          key={a.id}
          subtitle={a.account_type}
          color={a.color_hex}
          icon="wallet-outline"
          right={<Money minor={a.current_balance_minor} />}
          onPress={() => nav.navigate("AccountEdit", { id: a.id })}
        />
      ))}
    </Page>
  );
}
export function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    s = useStore(),
    nav = useNav();
  const a = s.accounts.find((a) => a.id === id);
  const [name, setName] = useState(a?.name ?? ""),
    [type, setType] = useState<Account["account_type"]>(
      a?.account_type ?? "BANK",
    ),
    [color, setColor] = useState(a?.color_hex ?? s.settings.accent),
    [balance, setBalance] = useState(a ? String(a.current_balance) : "0");
  return (
    <Page
      title={a ? "Account settings" : "New account"}
      subtitle="Balances come from the ledger. Reconciliation creates an auditable adjustment, excluded from income and spending."
    >
      <Card>
        <Field label="Account name" value={name} onChange={setName} />
        <Chips
          values={["BANK", "CASH", "WALLET", "BANK_1", "BANK_2"] as const}
          value={type}
          onChange={setType}
        />
        <Field
          label="Account color · #RRGGBB"
          value={color}
          onChange={setColor}
        />
        <Field
          label={a ? "Reconciled balance" : "Opening balance"}
          value={balance}
          onChange={setBalance}
        />
        <Button
          title="Save account"
          onPress={() =>
            void act(
              async () => {
                if (!/^-?\d+(\.\d{1,2})?$/.test(balance))
                  throw Error("Enter a balance with at most two decimals");
                const key = await AccountRepository.save(
                  id ?? null,
                  name,
                  type,
                  color,
                );
                await AccountRepository.rebalance(key, name, Number(balance));
              },
              () => nav.goBack(),
            )
          }
        />
      </Card>
      {a && (
        <Button
          title="Archive empty account"
          secondary
          onPress={() =>
            void act(
              () => AccountRepository.archive(a.id),
              () => nav.goBack(),
            )
          }
        />
      )}
    </Page>
  );
}
