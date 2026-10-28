import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { dateKey } from "../../domain/shift";
import { useStore } from "../../state/store";
import { Card, Chips, Label, Page } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton } from "../design/primitives";
import { RecordSettingsScreen, StartSetup } from "../editor/Screens";
import { Money, Tile } from "./components";
import { Empty } from "./screenKit";
export function RemindersScreen() {
  const s = useStore(),
    nav = useNav();
  const [view, setView] = useState("UPCOMING");
  const rows = s.dueReminders
    .filter(
      (r) =>
        r.enabled &&
        (view === "DISMISSED"
          ? r.status === "DISMISSED"
          : r.status !== "DISMISSED" &&
            (view === "OVERDUE"
              ? r.occurrence_date < dateKey()
              : r.occurrence_date >= dateKey())),
    )
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  return (
    <Page
      title="Reminders"
      trailing={
        <IconButton
          icon="add"
          label="New reminder"
          onPress={() => nav.navigate("ReminderEdit")}
        />
      }
    >
      {s.alarmWarning && (
        <Card>
          <Label>{s.alarmWarning}</Label>
        </Card>
      )}
      <Chips
        values={["UPCOMING", "OVERDUE", "DISMISSED"]}
        value={view}
        onChange={setView}
      />
      {rows.slice(0, 100).map((r) => (
        <Tile
          key={r.id}
          title={r.title}
          subtitle={`${r.occurrence_date} · ${r.kind}`}
          right={<Money minor={r.amount_minor} />}
          onPress={() => nav.navigate("DueDetails", { id: r.id })}
        />
      ))}
      {!rows.length && <Empty text="No reminders here" />}
    </Page>
  );
}
export function ReminderEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <RecordSettingsScreen entity="due" id={id} />
  ) : (
    <StartSetup entity="due" />
  );
}
