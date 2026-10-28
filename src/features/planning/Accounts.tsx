import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { useStore } from "../../state/store";
import { Page } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton } from "../design/primitives";
import { RecordSettingsScreen, StartSetup } from "../editor/Screens";
import { Money, Tile, Toggle } from "./components";
export function AccountsScreen() {
  const s = useStore(),
    nav = useNav();
  const [archived, setArchived] = useState(false);
  return (
    <Page
      title="Accounts"
      trailing={
        <IconButton
          icon="add"
          label="New account"
          onPress={() => nav.navigate("AccountEdit")}
        />
      }
    >
      <Toggle
        label="Show archived accounts"
        value={archived}
        onChange={setArchived}
      />
      {(archived ? s.archivedAccounts : s.accounts).map((a) => (
        <Tile
          title={a.name}
          key={a.id}
          subtitle={
            a.account_type.startsWith("BANK") ? "Bank account" : a.account_type
          }
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
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <RecordSettingsScreen entity="account" id={id} />
  ) : (
    <StartSetup entity="account" />
  );
}
