import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { db, uid } from "../../db/connection";
import { dateKey } from "../../domain/shift";
import { useStore } from "../../state/store";
import { act, Button, Card, Chips, Field, Label, Page } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { validDate } from "./calculations";
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
      subtitle="Generated locally from your plans. Work break reminders are configured separately."
    >
      <Button
        title="Notification preferences"
        onPress={() => nav.navigate("Settings")}
      />
      <Button
        title="＋ Personal due-date reminder"
        secondary
        onPress={() => nav.navigate("ReminderEdit")}
      />
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
      {!rows.length && (
        <Empty text="No reminders in this view. Add a plan or personal due date." />
      )}
    </Page>
  );
}
export function ReminderEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const s = useStore(),
    nav = useNav();
  const existing = s.dueReminders.find(
    (r) => r.id === id && r.kind === "CUSTOM",
  );
  const [title, setTitle] = useState(existing?.title ?? ""),
    [date, setDate] = useState(existing?.occurrence_date ?? dateKey()),
    [time, setTime] = useState(
      existing
        ? new Date(existing.notification_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : `${String(Math.floor(s.settings.financeReminderMinute / 60)).padStart(2, "0")}:${String(s.settings.financeReminderMinute % 60).padStart(2, "0")}`,
    );
  return (
    <Page
      title="Personal reminder"
      subtitle="An on-device reminder for a bill or any due date."
    >
      <Card>
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Due date · YYYY-MM-DD" value={date} onChange={setDate} />
        <Field
          label="Alert time · HH:mm (24-hour)"
          value={time}
          onChange={setTime}
        />
        <Button
          title="Save reminder"
          onPress={() =>
            void act(
              async () => {
                validDate.parse(date);
                if (!title.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
                  throw Error("Enter a title and valid time");
                const at = new Date(`${date}T${time}`);
                if (at.getTime() <= Date.now())
                  throw Error("Choose a future date/time");
                const key = id ?? uid();
                await db().runAsync(
                  "INSERT INTO reminders(id,kind,source_id,occurrence_date,title,due_at,notification_at) VALUES(?,'CUSTOM',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET occurrence_date=excluded.occurrence_date,title=excluded.title,due_at=excluded.due_at,notification_at=excluded.notification_at,status='PENDING',enabled=1",
                  key,
                  key,
                  date,
                  title.trim(),
                  at.toISOString(),
                  at.toISOString(),
                );
              },
              () => nav.goBack(),
            )
          }
        />
      </Card>
    </Page>
  );
}
