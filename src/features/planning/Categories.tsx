import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { useStore } from "../../state/store";
import { Chips, Page } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton } from "../design/primitives";
import { RecordSettingsScreen, StartSetup } from "../editor/Screens";
import { Tile, Toggle } from "./components";
const icons = [
  "restaurant-outline",
  "car-outline",
  "bag-outline",
  "home-outline",
  "flash-outline",
  "heart-outline",
  "film-outline",
  "school-outline",
  "person-outline",
  "airplane-outline",
  "briefcase-outline",
  "cash-outline",
];
export function CategoriesScreen() {
  const s = useStore(),
    nav = useNav();
  const [kind, setKind] = useState("EXPENSE"),
    [archived, setArchived] = useState(false);
  return (
    <Page
      title="Categories"
      trailing={
        <IconButton
          icon="add"
          label="New category"
          onPress={() => nav.navigate("CategoryEdit")}
        />
      }
    >
      <Chips values={["EXPENSE", "INCOME"]} value={kind} onChange={setKind} />
      <Toggle
        label="Show archived categories"
        value={archived}
        onChange={setArchived}
      />
      {s.categories
        .filter(
          (c) =>
            (archived ? !c.is_active : !!c.is_active) &&
            (c.kind === kind || c.kind === "BOTH"),
        )
        .map((c) => (
          <Tile
            key={c.id}
            title={c.name}
            subtitle={`${s.transactions.filter((x) => x.category_id === c.id).length} entries`}
            color={c.color_hex}
            icon={c.icon_name as React.ComponentProps<typeof Tile>["icon"]}
            onPress={() => nav.navigate("CategoryEdit", { id: c.id })}
          />
        ))}
    </Page>
  );
}
export function CategoryEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <RecordSettingsScreen entity="category" id={id} />
  ) : (
    <StartSetup entity="category" />
  );
}
