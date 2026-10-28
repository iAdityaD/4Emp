import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { CategoryRepository } from "../../repositories/CategoryRepository";
import { useStore } from "../../state/store";
import { act, Button, Card, Chips, Field, Label, Page } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
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
      subtitle="Rename, recolor, archive or create your own."
    >
      <Chips values={["EXPENSE", "INCOME"]} value={kind} onChange={setKind} />
      <Toggle
        label="Show archived categories"
        value={archived}
        onChange={setArchived}
      />
      <Button
        title="＋ New category"
        onPress={() => nav.navigate("CategoryEdit")}
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
  const { id } = useLocalSearchParams<{ id?: string }>(),
    s = useStore(),
    nav = useNav();
  const c = s.categories.find((c) => c.id === id);
  const [name, setName] = useState(c?.name ?? ""),
    [kind, setKind] = useState<"EXPENSE" | "INCOME" | "BOTH">(
      c?.kind ?? "EXPENSE",
    ),
    [icon, setIcon] = useState(c?.icon_name ?? icons[0]!),
    [color, setColor] = useState(c?.color_hex ?? s.settings.accent);
  return (
    <Page title={c ? "Edit category" : "New category"}>
      <Card>
        <Field label="Category name" value={name} onChange={setName} />
        <Chips
          values={["EXPENSE", "INCOME", "BOTH"] as const}
          value={kind}
          onChange={setKind}
        />
        <Label muted>Icon</Label>
        <Chips values={icons} value={icon} onChange={setIcon} />
        <Field label="Color · #RRGGBB" value={color} onChange={setColor} />
        <Button
          title={
            c && !c.is_active ? "Restore and save category" : "Save category"
          }
          onPress={() =>
            void act(
              () =>
                CategoryRepository.save(
                  { name, kind, icon_name: icon, color_hex: color },
                  id,
                ),
              () => nav.goBack(),
            )
          }
        />
      </Card>
      {c && (
        <Button
          secondary
          title="Archive category"
          onPress={() =>
            void act(
              () => CategoryRepository.archive(c.id),
              () => nav.goBack(),
            )
          }
        />
      )}
    </Page>
  );
}
