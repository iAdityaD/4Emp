import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { SettingsRepository } from "../../repositories/SettingsRepository";
import { useStore } from "../../state/store";
import { act, Card, Label, Page } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { WeekBars } from "../design/charts";
import { durationText, parseClockValue } from "../design/color";
import { IconButton, MenuRow, Section } from "../design/primitives";
import { openField, RecordSettingsScreen, StartSetup } from "../editor/Screens";
import { Toggle } from "./components";
export const parseClock = parseClockValue;
export function WorkSettingsScreen() {
  const s = useStore(),
    nav = useNav(),
    router = useRouter();
  return (
    <Page title="Work settings">
      <Section title="Hours" />
      <Card>
        <MenuRow
          title="Daily target"
          value={durationText(s.settings.baseline)}
          icon="time-outline"
          onPress={() => openField(router, "settings", "baseline")}
        />
        <MenuRow
          title="Safety buffer"
          value={durationText(s.settings.buffer)}
          icon="shield-checkmark-outline"
          onPress={() => openField(router, "settings", "buffer")}
        />
        <MenuRow
          title="Tracking mode"
          value={s.settings.mode === "NET" ? "Working time" : "Elapsed time"}
          icon="pulse-outline"
          onPress={() => openField(router, "settings", "mode")}
        />
        <MenuRow
          title="Default shift"
          value={s.settings.defaultShiftType.replaceAll("_", " ")}
          icon="business-outline"
          onPress={() => openField(router, "settings", "defaultShiftType")}
        />
      </Card>
      <Section title="Schedule" />
      <Card>
        <MenuRow
          title="Preferred start"
          value={durationText(s.settings.startOfDay)}
          icon="sunny-outline"
          onPress={() => openField(router, "settings", "startOfDay")}
        />
        <MenuRow
          title="Day reset"
          value={durationText(s.settings.cutoff)}
          icon="moon-outline"
          onPress={() => openField(router, "settings", "cutoff")}
        />
        <MenuRow
          title="Weekday targets"
          icon="calendar-outline"
          onPress={() => router.push("/work-week")}
        />
        <MenuRow
          title="Profiles"
          value={String(s.profiles.filter((p) => p.is_active).length)}
          icon="layers-outline"
          onPress={() => nav.navigate("WorkProfiles")}
        />
      </Card>
      <Section title="Shift alerts" />
      <Card>
        <MenuRow
          title="Advance warning"
          value={durationText(s.settings.shiftWarningMinutes)}
          icon="notifications-outline"
          onPress={() => openField(router, "settings", "shiftWarningMinutes")}
        />
        <MenuRow
          title="Overtime"
          value={durationText(s.settings.overtimeMinutes)}
          icon="alarm-outline"
          onPress={() => openField(router, "settings", "overtimeMinutes")}
        />
      </Card>
    </Page>
  );
}
export function WorkWeekScreen() {
  const s = useStore(),
    router = useRouter(),
    days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
  return (
    <Page title="Weekday targets">
      <Card>
        <WeekBars
          values={s.settings.weekTargets}
          labels={days.map((d) => d.slice(0, 1))}
        />
        <Toggle
          label="Use weekday targets"
          value={s.settings.useWeeklyTargets}
          onChange={(v) => void s.configure("useWeeklyTargets", v)}
        />
      </Card>
      <Card>
        {days.map((d, i) => (
          <MenuRow
            key={d}
            title={d}
            value={
              s.settings.weekTargets[i]
                ? durationText(s.settings.weekTargets[i]!)
                : "Rest day"
            }
            icon="time-outline"
            onPress={() => openField(router, "settings", `week-${i}`)}
          />
        ))}
      </Card>
      <Card>
        <MenuRow
          title="Days off"
          icon="calendar-outline"
          onPress={() => openField(router, "settings", "weekends")}
        />
        <MenuRow
          title="Office days per week"
          value={String(s.settings.officeDays)}
          icon="business-outline"
          onPress={() => openField(router, "settings", "officeDays")}
        />
      </Card>
    </Page>
  );
}
export function WorkProfilesScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <Page
      title="Work profiles"
      trailing={
        <IconButton
          icon="add"
          label="New profile"
          onPress={() => nav.navigate("PlanEdit", { kind: "profiles" })}
        />
      }
    >
      <Card>
        {s.profiles
          .filter((p) => p.is_active)
          .map((p) => (
            <MenuRow
              key={p.id}
              title={p.title}
              value={`${durationText(p.target_minutes)} · ${p.tracking_mode}`}
              icon="layers-outline"
              onPress={() =>
                nav.navigate("PlanEdit", { kind: "profiles", id: p.id })
              }
              trailing={
                <IconButton
                  icon="checkmark"
                  label={`Apply ${p.title}`}
                  onPress={() =>
                    void act(
                      async () => {
                        await SettingsRepository.save(
                          "baseline",
                          p.target_minutes,
                        );
                        await SettingsRepository.save(
                          "buffer",
                          p.buffer_minutes,
                        );
                        await SettingsRepository.save("mode", p.tracking_mode);
                        await SettingsRepository.save(
                          "cutoff",
                          p.cutoff_minute,
                        );
                        await SettingsRepository.save(
                          "defaultShiftType",
                          p.shift_type,
                        );
                        await SettingsRepository.save(
                          "weekends",
                          127 ^ p.weekdays,
                        );
                        await SettingsRepository.save(
                          "weekTargets",
                          [0, 1, 2, 3, 4, 5, 6].map((i) =>
                            p.weekdays & (1 << i) ? p.target_minutes : 0,
                          ),
                        );
                      },
                      () => nav.goBack(),
                    )
                  }
                />
              }
            />
          ))}
        {!s.profiles.filter((p) => p.is_active).length && (
          <Label muted>No profiles yet</Label>
        )}
      </Card>
    </Page>
  );
}
export function ManualShiftScreen() {
  return <StartSetup entity="worklog" />;
}
export function BreakEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecordSettingsScreen entity="break" id={id} />;
}
export function WorkRecordScreen() {
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>(),
    s = useStore(),
    router = useRouter();
  const shift = s.shifts.find((x) => x.id === shiftId);
  if (!shift)
    return (
      <Page title="Shift unavailable">
        <Label>No record.</Label>
      </Page>
    );
  return <RecordSettingsScreen entity="worklog" id={shiftId} />;
}
