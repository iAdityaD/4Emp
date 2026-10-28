import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";
import { formTime } from "../../domain/shift";
import { SettingsRepository } from "../../repositories/SettingsRepository";
import { ShiftRepository } from "../../repositories/ShiftRepository";
import { useStore } from "../../state/store";
import {
  Button,
  Card,
  Chips,
  Edit,
  Field,
  Label,
  Page,
  Row,
  act,
} from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { Tile, Toggle } from "./components";
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export function parseClock(s: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    throw Error("Enter time as HH:mm, using the 24-hour clock");
  const [h, m] = s.split(":").map(Number);
  return h! * 60 + m!;
}
export function WorkSettingsScreen() {
  const s = useStore(),
    nav = useNav();
  const [baseline, setBaseline] = useState(String(s.settings.baseline)),
    [buffer, setBuffer] = useState(String(s.settings.buffer)),
    [cutoff, setCutoff] = useState(time(s.settings.cutoff)),
    [start, setStart] = useState(time(s.settings.startOfDay)),
    [weekly, setWeekly] = useState(s.settings.weekTargets.map(String)),
    [useWeekly, setUseWeekly] = useState(s.settings.useWeeklyTargets),
    [mode, setMode] = useState(s.settings.mode),
    [warning, setWarning] = useState(String(s.settings.shiftWarningMinutes)),
    [overtime, setOvertime] = useState(String(s.settings.overtimeMinutes));
  return (
    <Page
      title="Work preferences"
      subtitle="Your hours are personal. Nothing is sent to an employer."
    >
      <Card>
        <Field
          label="Default mandatory minutes"
          value={baseline}
          onChange={setBaseline}
          numeric
        />
        <Field
          label="Safety buffer minutes (0–60)"
          value={buffer}
          onChange={setBuffer}
          numeric
        />
        <Chips
          values={["GROSS", "NET"] as const}
          value={mode}
          onChange={setMode}
        />
        <Label muted>
          Gross includes breaks. Net deducts their actual elapsed time.
        </Label>
        <Field
          label="Preferred start · HH:mm"
          value={start}
          onChange={setStart}
        />
        <Field
          label="Company day reset · HH:mm"
          value={cutoff}
          onChange={setCutoff}
        />
        <Toggle
          label="Use different targets by weekday"
          value={useWeekly}
          onChange={setUseWeekly}
        />
        {useWeekly &&
          weekly.map((v, i) => (
            <Field
              key={i}
              label={`${days[i]} mandatory minutes (0 = rest day)`}
              value={v}
              numeric
              onChange={(v) =>
                setWeekly((a) => a.map((x, j) => (i === j ? v : x)))
              }
            />
          ))}
        <Field
          label="Target warning minutes before (0 = off)"
          value={warning}
          onChange={setWarning}
          numeric
        />
        <Field
          label="Overtime reminder minutes after (0 = off)"
          value={overtime}
          onChange={setOvertime}
          numeric
        />
        <Button
          title="Save work preferences"
          onPress={() =>
            void act(async () => {
              const b = Number(baseline),
                g = Number(buffer),
                values = weekly.map(Number);
              if (
                !Number.isInteger(b) ||
                b < 1 ||
                b > 1440 ||
                !Number.isInteger(g) ||
                g < 0 ||
                g > 60 ||
                values.some((v) => !Number.isInteger(v) || v < 0 || v > 1440)
              )
                throw Error(
                  "Targets must be 1–1440 minutes, weekly rest days can be 0, and buffer 0–60",
                );
              await SettingsRepository.save(
                "shiftWarningMinutes",
                Number(warning),
              );
              await SettingsRepository.save(
                "overtimeMinutes",
                Number(overtime),
              );
              await SettingsRepository.save("baseline", b);
              await SettingsRepository.save("buffer", g);
              await SettingsRepository.save("mode", mode);
              await SettingsRepository.save("cutoff", parseClock(cutoff));
              await SettingsRepository.save("startOfDay", parseClock(start));
              await SettingsRepository.save("weekTargets", values);
              await SettingsRepository.save("useWeeklyTargets", useWeekly);
            })
          }
        />
      </Card>
      <Tile
        title="Reusable work profiles"
        subtitle="Office days, client sites, short shifts and more"
        onPress={() => nav.navigate("WorkProfiles")}
      />
      <Tile
        title="Add past work log"
        subtitle="Record a missed shift without starting a live timer"
        onPress={() => nav.navigate("ManualShift")}
      />
      <Tile
        title="Attendance calendar"
        onPress={() => nav.navigate("Calendar")}
      />
      <Tile
        title="Safe arrival calculator"
        onPress={() => nav.navigate("SafeArrival")}
      />
    </Page>
  );
}
export function WorkProfilesScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <Page
      title="Work profiles"
      subtitle="Apply a profile as defaults; active shifts retain their saved settings."
    >
      <Button
        title="＋ Create profile"
        onPress={() => nav.navigate("PlanEdit", { kind: "profiles" })}
      />
      {!s.profiles.length && (
        <Card>
          <Label muted>
            No profiles yet. Save your own hours and tracking style.
          </Label>
        </Card>
      )}
      {s.profiles
        .filter((p) => p.is_active)
        .map((p) => (
          <Card key={p.id}>
            <Row>
              <Label weight>{p.title}</Label>
              <Edit
                onPress={() =>
                  nav.navigate("PlanEdit", { kind: "profiles", id: p.id })
                }
              />
            </Row>
            <Label muted>
              {p.target_minutes}m + {p.buffer_minutes}m buffer ·{" "}
              {p.tracking_mode} · Reset {time(p.cutoff_minute)}
            </Label>
            <Button
              title="Apply profile"
              onPress={() =>
                void act(async () => {
                  await SettingsRepository.save("baseline", p.target_minutes);
                  await SettingsRepository.save("buffer", p.buffer_minutes);
                  await SettingsRepository.save("mode", p.tracking_mode);
                  await SettingsRepository.save("cutoff", p.cutoff_minute);
                  await SettingsRepository.save(
                    "defaultShiftType",
                    p.shift_type,
                  );
                  await SettingsRepository.save("weekends", 127 ^ p.weekdays);
                  await SettingsRepository.save(
                    "weekTargets",
                    days.map((_, i) =>
                      p.weekdays & (1 << i) ? p.target_minutes : 0,
                    ),
                  );
                })
              }
            />
          </Card>
        ))}
    </Page>
  );
}
export function ManualShiftScreen() {
  const s = useStore(),
    nav = useNav();
  const [start, setStart] = useState(formTime(Date.now() - 3600000)),
    [end, setEnd] = useState(formTime(Date.now())),
    [target, setTarget] = useState(String(s.settings.baseline)),
    [notes, setNotes] = useState(""),
    [type, setType] = useState<"OFFICE" | "WFH" | "CUSTOM">("OFFICE");
  return (
    <Page
      title="Add work log"
      subtitle="Manual attendance for any of the seven days. Overlapping sessions are rejected."
    >
      <Card>
        <Chips
          values={["OFFICE", "WFH", "CUSTOM"] as const}
          value={type}
          onChange={setType}
        />
        <Field
          label="Swipe in · YYYY-MM-DDTHH:mm"
          value={start}
          onChange={setStart}
        />
        <Field
          label="Swipe out · YYYY-MM-DDTHH:mm"
          value={end}
          onChange={setEnd}
        />
        <Field
          label="Target minutes"
          value={target}
          onChange={setTarget}
          numeric
        />
        <Field label="Notes" value={notes} onChange={setNotes} />
        <Button
          title="Save completed shift"
          onPress={() =>
            void act(
              () =>
                ShiftRepository.addManual(
                  Date.parse(start),
                  Date.parse(end),
                  Number(target),
                  type,
                  notes,
                  s.settings,
                ),
              () => nav.goBack(),
            )
          }
        />
      </Card>
    </Page>
  );
}
export function BreakEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore(),
    nav = useNav();
  const b = s.breaks.find((x) => x.id === id);
  const [start, setStart] = useState(b ? formTime(b.break_start) : ""),
    [end, setEnd] = useState(b?.break_end ? formTime(b.break_end) : "");
  if (!b)
    return (
      <Page title="Break unavailable">
        <Label>No record.</Label>
      </Page>
    );
  return (
    <Page
      title="Correct break"
      subtitle="Times must fit the shift and cannot overlap another break. Leave end empty for a live break."
    >
      <Card>
        <Field
          label="Break start · YYYY-MM-DDTHH:mm"
          value={start}
          onChange={setStart}
        />
        <Field
          label="Break end · YYYY-MM-DDTHH:mm"
          value={end}
          onChange={setEnd}
        />
        <Button
          title="Save correction"
          onPress={() =>
            void act(
              () =>
                ShiftRepository.editBreak(
                  b.id,
                  Date.parse(start),
                  end ? Date.parse(end) : null,
                ),
              () => nav.goBack(),
            )
          }
        />
        <Button
          title="Delete mistaken break"
          secondary
          onPress={() =>
            Alert.alert(
              "Delete break?",
              "Net work duration and the target swipe-out time will be recalculated.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    void act(
                      () => ShiftRepository.deleteBreak(b.id),
                      () => nav.goBack(),
                    ),
                },
              ],
            )
          }
        />
      </Card>
    </Page>
  );
}
