import React from "react";
import { useRouter } from "expo-router";
import { useStore } from "../../state/store";
import { Card, Label, Page } from "../../ui/kit";
import { IconButton, MenuRow } from "../design/primitives";
import { durationText } from "../design/color";
import { Toggle } from "./components";
import { useNav } from "../../ui/navigation";
export function WorkScheduleScreen() {
  const s = useStore(),
    router = useRouter(),
    nav = useNav();
  return (
    <Page
      title="Work schedule"
      trailing={
        <IconButton
          icon="add"
          label="Add schedule"
          onPress={() => router.push("/work-reminder")}
        />
      }
    >
      <Card>
        <Toggle
          label="Schedule & work alerts"
          value={s.settings.workNotifications}
          onChange={(v) => void s.configure("workNotifications", v)}
        />
        <MenuRow
          title="Workdays & leave"
          icon="calendar-outline"
          onPress={() => nav.navigate("Calendar")}
        />
        <MenuRow
          title="Weekday hours"
          icon="time-outline"
          onPress={() => router.push("/work-week")}
        />
      </Card>
      {s.settings.reminders.map((r) => (
        <Card key={r.id}>
          <MenuRow
            title={r.title}
            icon="alarm-outline"
            value={`${durationText(r.minute)} · ${r.day_scope === "DAYS_OFF" ? "Leave & days off" : "Workdays"} · ${r.enabled ? "On" : "Off"}`}
            onPress={() =>
              router.push({ pathname: "/work-reminder", params: { id: r.id } })
            }
          />
        </Card>
      ))}
      {!s.settings.reminders.length && <Label muted>No schedules yet</Label>}
    </Page>
  );
}
