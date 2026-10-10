import React, { useState } from "react";
import { View, Alert, Pressable } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import {
  Page,
  Card,
  Row,
  Label,
  Button,
  Chips,
  Field,
  Edit,
  useTheme,
  useNow,
  act,
} from "../ui/kit";
import { Ring } from "../ui/Ring";
import { RootStack, useNav } from "../ui/navigation";
import { useStore } from "../state/store";
import { ShiftType } from "../domain/models";
import {
  clock,
  hours,
  metrics,
  safeArrival,
  dateKey,
  localDate,
  shiftTarget,
  formTime,
} from "../domain/shift";
import { ShiftRepository } from "../repositories/ShiftRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";
const types: ShiftType[] = [
  "OFFICE",
  "WFH",
  "HALF_DAY",
  "CUSTOM",
  "OPEN_ENDED",
];
export function HomeScreen() {
  const s = useStore(),
    nav = useNav(),
    now = useNow(),
    t = useTheme();
  const [type, setType] = useState<ShiftType>("OFFICE"),
    [custom, setCustom] = useState("180");
  const active = s.shifts.find((x) => x.status === "ACTIVE"),
    review = s.shifts.find((x) => x.status === "NEEDS_REVIEW");
  const breaks = s.breaks.filter((b) => b.shift_id === active?.id);
  const m = active ? metrics(active, breaks, now) : null;
  const arrival = safeArrival(
    now,
    s.settings.cutoff,
    s.settings.baseline,
    s.settings.buffer,
  );
  const muted =
    s.marks.some((x) => x.work_date === dateKey(now) && x.kind !== "WORKED") ||
    s.holidays.some((h) => h.holiday_date === dateKey(now) && !h.is_optional);
  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void act(() => ShiftRepository.start(type, Number(custom), s.settings));
  };
  const out = () =>
    Alert.alert("Finish shift?", "Record your actual swipe-out time now.", [
      { text: "Keep working", style: "cancel" },
      {
        text: "Swipe out",
        onPress: () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          void act(() => ShiftRepository.complete(active!));
        },
      },
    ]);
  const leave = () =>
    Alert.alert(
      "On leave today?",
      active
        ? "Record swipe out now and pause today’s reminders?"
        : "Pause all reminders for today?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () =>
            void act(async () => {
              if (active) await ShiftRepository.complete(active);
              await HolidayRepository.mark(dateKey(), "LEAVE");
            }),
        },
      ],
    );
  return (
    <Page
      title="Your personal cockpit."
      subtitle={new Date(now).toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      <Row>
        <Label color={t.cyan}>
          {active?.tracking_mode ?? s.settings.mode} mode
        </Label>
        <Edit
          label="Timing settings"
          onPress={() => nav.navigate("SafeArrival")}
        />
      </Row>
      {s.alarmWarning && (
        <Card>
          <Label size={12} color={t.orange}>
            {s.alarmWarning}
          </Label>
        </Card>
      )}
      {review && (
        <Card>
          <Label weight>Unclosed shift needs review</Label>
          <Label muted>
            Your hours stopped at the reset cutoff. Confirm the actual end time.
          </Label>
          <Button
            title="Review shift"
            onPress={() => nav.navigate("ShiftDetails", { shiftId: review.id })}
          />
        </Card>
      )}
      {muted ? (
        <Card>
          <Label size={24}>A day for yourself.</Label>
          <Label muted>Today’s notifications are paused.</Label>
          <Button
            title="Resume work today"
            onPress={() =>
              void act(async () => {
                await HolidayRepository.mark(dateKey(), null);
                const holiday = s.holidays.find(
                  (h) => h.holiday_date === dateKey(),
                );
                if (holiday) await HolidayRepository.remove(holiday.id);
              })
            }
          />
        </Card>
      ) : (
        <>
          {!active && (
            <>
              <Card>
                <Label size={12} color={t.cyan}>
                  Cutoff {clock(arrival.cutoff)} • Swipe in by{" "}
                  {clock(arrival.latest)}
                </Label>
                <Label muted size={12}>
                  Fulfill today’s target before the company day resets.
                </Label>
              </Card>
              <Chips values={types} value={type} onChange={setType} />
              {type === "CUSTOM" && (
                <Field
                  label="Today’s custom target (minutes)"
                  value={custom}
                  onChange={setCustom}
                  numeric
                />
              )}
            </>
          )}
          <Card>
            <Ring
              progress={m?.progress ?? 0}
              value={
                m
                  ? active!.shift_type === "OPEN_ENDED"
                    ? hours(m.productive)
                    : hours(m.remaining)
                  : hours(
                      (shiftTarget(type, s.settings.baseline, Number(custom)) +
                        (type === "OPEN_ENDED" ? 0 : s.settings.buffer)) *
                        60000,
                    )
              }
              label={
                active?.shift_type === "OPEN_ENDED"
                  ? "ELAPSED"
                  : m?.review
                    ? "NEEDS REVIEW"
                    : "REMAINING"
              }
              sub={
                active
                  ? `${active.shift_type.replace("_", " ")} · +${active.buffer_minutes}m buffer`
                  : `${type.replace("_", " ")} · +${type === "OPEN_ENDED" ? 0 : s.settings.buffer}m buffer`
              }
            />
            {active && m && (
              <>
                <Row>
                  <Label muted>Swipe in {clock(active.first_swipe_in)}</Label>
                  <Label color={t.cyan}>
                    {active.shift_type === "OPEN_ENDED"
                      ? "No fixed target"
                      : `Target ${clock(m.target)}`}
                  </Label>
                </Row>
                <Row>
                  <Label size={12}>Gross {hours(m.gross)}</Label>
                  <Label size={12}>Net {hours(m.net)}</Label>
                </Row>
                <Label size={12} muted>
                  Break elapsed {hours(m.pause)}
                  {active.tracking_mode === "GROSS" ? " · not deducted" : ""}
                </Label>
              </>
            )}
            {!active ? (
              <Button title="Swipe in" disabled={!!review} onPress={start} />
            ) : m?.review ? (
              <Button
                title="Confirm actual swipe out"
                onPress={() =>
                  nav.navigate("ShiftDetails", { shiftId: active.id })
                }
              />
            ) : (
              <>
                <Button title="Swipe out" onPress={out} />
                <Button
                  secondary
                  title={m?.breakActive ? "End break" : "Start break"}
                  onPress={() =>
                    void act(() => ShiftRepository.toggleBreak(active))
                  }
                />
                <Button
                  secondary
                  title="Break history"
                  onPress={() =>
                    nav.navigate("BreakHistory", { shiftId: active.id })
                  }
                />
              </>
            )}
          </Card>
          <Button title="On leave today" secondary onPress={leave} />
        </>
      )}
    </Page>
  );
}
export function SafeArrivalScreen() {
  const s = useStore(),
    now = useNow(),
    [minutes, setMinutes] = useState(String(s.settings.baseline));
  const a = safeArrival(
    now,
    s.settings.cutoff,
    s.settings.baseline,
    s.settings.buffer,
  );
  return (
    <Page title="Safe arrival" subtitle="Your company day, your safety margin.">
      <Card>
        <Label size={28} weight>
          {clock(a.latest)}
        </Label>
        <Label muted>Latest safe arrival • reset {clock(a.cutoff)}</Label>
      </Card>
      <Card>
        <Field
          label="Mandatory minutes"
          value={minutes}
          onChange={setMinutes}
          numeric
        />
        <Button
          title="Save target"
          onPress={() =>
            void act(async () => {
              const n = Number(minutes);
              if (!Number.isFinite(n) || n < 1 || n > 1440)
                throw Error("Choose 1–1440 minutes");
              await SettingsRepository.save("baseline", n);
            })
          }
        />
        <Chips
          values={["GROSS", "NET"] as const}
          value={s.settings.mode}
          onChange={(v) => void s.configure("mode", v)}
        />
        <Label muted>Grace buffer</Label>
        <Chips
          values={["0", "3", "5", "10"]}
          value={String(s.settings.buffer)}
          onChange={(v) => void s.configure("buffer", Number(v))}
        />
      </Card>
    </Page>
  );
}
export function ShiftDetailsScreen() {
  const { params } = useRoute<RouteProp<RootStack, "ShiftDetails">>(),
    s = useStore(),
    nav = useNav(),
    now = useNow();
  const shift = s.shifts.find((x) => x.id === params.shiftId);
  const [start, setStart] = useState(
      shift ? formTime(shift.first_swipe_in) : "",
    ),
    [end, setEnd] = useState(
      shift?.last_swipe_out
        ? formTime(shift.last_swipe_out)
        : formTime(
            Math.min(
              now,
              Date.parse(shift?.cutoff_at ?? new Date(now).toISOString()),
            ),
          ),
    ),
    [notes, setNotes] = useState(shift?.notes ?? ""),
    [target, setTarget] = useState(String(shift?.target_minutes ?? 0));
  if (!shift)
    return (
      <Page title="Shift unavailable">
        <Label>No record found.</Label>
      </Page>
    );
  return (
    <Page
      title={
        shift.status === "NEEDS_REVIEW"
          ? "Confirm yesterday’s swipe out"
          : "Shift details"
      }
      subtitle="Enter local date and time: YYYY-MM-DDTHH:mm."
    >
      <Card>
        <Label>
          {shift.work_date} • {shift.shift_type} • {shift.status}
        </Label>
        <Field label="Swipe in" value={start} onChange={setStart} />
        <Field label="Swipe out" value={end} onChange={setEnd} />
        <Field label="Notes" value={notes} onChange={setNotes} multiline />
        <Button
          title="Confirm times"
          onPress={() =>
            void act(
              async () => {
                const a = Date.parse(start),
                  b = Date.parse(end);
                await ShiftRepository.edit(shift, a, b, notes);
              },
              () => nav.goBack(),
            )
          }
        />
      </Card>
      {shift.shift_type !== "OPEN_ENDED" && (
        <Card>
          <Field
            label="Override target minutes for this shift"
            value={target}
            onChange={setTarget}
            numeric
          />
          <Button
            secondary
            title="Update target"
            onPress={() =>
              void act(() =>
                ShiftRepository.changeTarget(shift, Number(target)),
              )
            }
          />
        </Card>
      )}
      <Button
        secondary
        title="Break history"
        onPress={() => nav.navigate("BreakHistory", { shiftId: shift.id })}
      />
    </Page>
  );
}
export function BreakHistoryScreen() {
  const { params } = useRoute<RouteProp<RootStack, "BreakHistory">>(),
    s = useStore();
  const list = s.breaks.filter((b) => b.shift_id === params.shiftId);
  return (
    <Page
      title="Break history"
      subtitle="Gross keeps breaks; net subtracts them."
    >
      {list.length === 0 && (
        <Card>
          <Label muted>No breaks recorded.</Label>
        </Card>
      )}
      {list.map((b) => (
        <Card key={b.id}>
          <Label>
            {clock(b.break_start)} →{" "}
            {b.break_end ? clock(b.break_end) : "In progress"}
          </Label>
          <Label muted>
            {hours(
              (b.break_end ? Date.parse(b.break_end) : Date.now()) -
                Date.parse(b.break_start),
            )}
          </Label>
        </Card>
      ))}
    </Page>
  );
}
export function CalendarScreen() {
  const s = useStore(),
    nav = useNav(),
    t = useTheme(),
    now = useNow();
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const week = s.shifts.filter(
    (x) =>
      localDate(x.work_date) >= monday &&
      localDate(x.work_date) <= new Date(now),
  );
  const total = week.reduce(
      (sum, x) =>
        sum +
        metrics(
          x,
          s.breaks.filter((b) => b.shift_id === x.id),
          now,
        ).productive,
      0,
    ),
    office = new Set(
      week.filter((x) => x.shift_type === "OFFICE").map((x) => x.work_date),
    ).size;
  const offset = (month.getDay() + 6) % 7,
    length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + length) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  return (
    <Page title="Calendar & logs">
      <Row>
        <Label weight>{hours(total)} this week</Label>
        <Label muted>
          {office}/{s.settings.officeDays} office days
        </Label>
      </Row>
      <Label muted>
        {
          s.marks.filter(
            (m) =>
              m.kind === "LEAVE" &&
              localDate(m.work_date) >= monday &&
              localDate(m.work_date) <= new Date(now),
          ).length
        }{" "}
        leave days this week
      </Label>
      <Card>
        <Row>
          <Button
            secondary
            title="‹"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          />
          <Label weight>
            {month.toLocaleDateString([], { month: "long", year: "numeric" })}
          </Label>
          <Button
            secondary
            title="›"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          />
        </Row>
        <View style={{ flexDirection: "row" }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((v, i) => (
            <View key={i} style={{ width: "14.28%", alignItems: "center" }}>
              <Label muted size={12}>
                {v}
              </Label>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((d, i) => {
            if (d < 1 || d > length)
              return <View key={i} style={{ width: "14.28%", height: 46 }} />;
            const date = dateKey(
              new Date(month.getFullYear(), month.getMonth(), d),
            );
            const shifts = s.shifts.filter((x) => x.work_date === date),
              mark = s.marks.find((x) => x.work_date === date),
              holiday = s.holidays.some((h) => h.holiday_date === date);
            const weekend = !!(
              s.settings.weekends &
              (1 <<
                (new Date(month.getFullYear(), month.getMonth(), d).getDay() +
                  6) %
                  7)
            );
            let color = t.muted;
            if (holiday) color = t.purple;
            else if (mark && mark.kind !== "WORKED") color = t.muted;
            else if (shifts.some((x) => x.shift_type === "WFH")) color = t.cyan;
            else if (shifts.length)
              color = shifts.every(
                (x) =>
                  x.status === "COMPLETED" &&
                  (x.shift_type === "OPEN_ENDED" ||
                    metrics(
                      x,
                      s.breaks.filter((b) => b.shift_id === x.id),
                      now,
                    ).remaining === 0),
              )
                ? t.accent
                : t.orange;
            else if (mark?.kind === "WORKED") color = t.accent;
            return (
              <Pressable
                key={i}
                accessibilityLabel={`${date} ${holiday ? "Holiday" : (mark?.kind ?? (shifts.length ? "Worked" : weekend ? "Weekend" : "No log"))}`}
                onPress={() => nav.navigate("DayDetails", { date })}
                style={{
                  width: "14.28%",
                  height: 46,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  backgroundColor:
                    date === dateKey(now) ? t.line : "transparent",
                }}
              >
                <Label color={color} weight>
                  {d}
                  {weekend ? "·" : ""}
                </Label>
              </Pressable>
            );
          })}
        </View>
        <Label size={11} muted>
          Green complete · Blue WFH · Orange partial · Purple holiday · Gray
          leave / non-working
        </Label>
      </Card>
      <Row>
        <Button
          title="Holiday list"
          secondary
          onPress={() => nav.navigate("Holidays")}
        />
        <Button
          title="Monthly report"
          secondary
          onPress={() => nav.navigate("Compliance")}
        />
      </Row>
    </Page>
  );
}
export function DayDetailsScreen() {
  const { params } = useRoute<RouteProp<RootStack, "DayDetails">>(),
    s = useStore(),
    nav = useNav(),
    now = useNow();
  const shifts = s.shifts.filter((x) => x.work_date === params.date);
  const mark = s.marks.find((x) => x.work_date === params.date);
  const [note, setNote] = useState(mark?.note ?? "");
  return (
    <Page title={params.date} subtitle={mark?.kind ?? "Workday log"}>
      {shifts.map((x) => {
        const m = metrics(
          x,
          s.breaks.filter((b) => b.shift_id === x.id),
          now,
        );
        return (
          <Card key={x.id}>
            <Row>
              <Label weight>
                {x.shift_type} • {x.status}
              </Label>
              <Edit
                onPress={() => nav.navigate("ShiftDetails", { shiftId: x.id })}
              />
            </Row>
            <Label>
              {clock(x.first_swipe_in)} →{" "}
              {x.last_swipe_out ? clock(x.last_swipe_out) : "Unclosed"}
            </Label>
            <Label muted>
              Gross {hours(m.gross)} • Net {hours(m.net)}
            </Label>
            <Label muted>Break {hours(m.pause)}</Label>
            {x.notes && <Label>{x.notes}</Label>}
          </Card>
        );
      })}
      <Card>
        <Field label="Day notes" value={note} onChange={setNote} multiline />
        <Chips
          values={["LEAVE", "NON_WORKING", "WORKED", "CLEAR"]}
          value={mark?.kind ?? "CLEAR"}
          onChange={(kind) => {
            if (params.date > dateKey() && kind === "WORKED") {
              Alert.alert(
                "Future date",
                "Worked logs must be today or earlier",
              );
              return;
            }
            if (
              shifts.some((x) => x.status === "ACTIVE") &&
              kind !== "WORKED" &&
              kind !== "CLEAR"
            ) {
              Alert.alert(
                "Active shift",
                "Swipe out or review the shift before declaring leave",
              );
              return;
            }
            void act(() =>
              HolidayRepository.mark(
                params.date,
                kind === "CLEAR"
                  ? null
                  : (kind as "LEAVE" | "NON_WORKING" | "WORKED"),
                note,
              ),
            );
          }}
        />
        <Button
          secondary
          title="Declare holiday"
          onPress={() => nav.navigate("AddHoliday", { date: params.date })}
        />
      </Card>
    </Page>
  );
}
export function AddHolidayScreen() {
  const route = useRoute<RouteProp<RootStack, "AddHoliday">>(),
    nav = useNav();
  const [date, setDate] = useState(route.params?.date ?? dateKey()),
    [title, setTitle] = useState(""),
    [optional, setOptional] = useState("NO");
  return (
    <Page title="Declare holiday">
      <Card>
        <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} />
        <Field label="Title" value={title} onChange={setTitle} />
        <Label muted>
          Optional holidays do not automatically pause reminders.
        </Label>
        <Chips values={["NO", "YES"]} value={optional} onChange={setOptional} />
        <Button
          title="Save holiday"
          onPress={() =>
            void act(
              () => HolidayRepository.add(date, title, optional === "YES"),
              () => nav.goBack(),
            )
          }
        />
      </Card>
    </Page>
  );
}
export function HolidaysScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <Page
      title="Company holidays"
      subtitle="Your list, not a mandated national calendar."
    >
      <Button title="Add holiday" onPress={() => nav.navigate("AddHoliday")} />
      {s.holidays.map((h) => (
        <Card key={h.id}>
          <Row>
            <View>
              <Label weight>{h.title}</Label>
              <Label muted>
                {h.holiday_date}
                {h.is_optional ? " · Optional" : ""}
              </Label>
            </View>
            <Button
              secondary
              title="Remove"
              onPress={() => void act(() => HolidayRepository.remove(h.id))}
            />
          </Row>
        </Card>
      ))}
    </Page>
  );
}
export function ComplianceScreen() {
  const s = useStore(),
    now = useNow(),
    [month, setMonth] = useState(dateKey().slice(0, 7));
  const list = s.shifts.filter((x) => x.work_date.startsWith(month));
  return (
    <Page
      title="Monthly compliance"
      subtitle="Personal reference; not an employer certification."
    >
      <Field label="Month (YYYY-MM)" value={month} onChange={setMonth} />
      <Card>
        <Label size={28} weight>
          {hours(
            list.reduce(
              (sum, x) =>
                sum +
                metrics(
                  x,
                  s.breaks.filter((b) => b.shift_id === x.id),
                  now,
                ).productive,
              0,
            ),
          )}
        </Label>
        <Label muted>
          {new Set(list.map((x) => x.work_date)).size} worked dates ·{" "}
          {
            s.marks.filter(
              (m) => m.kind === "LEAVE" && m.work_date.startsWith(month),
            ).length
          }{" "}
          leave dates
        </Label>
      </Card>
      {list.map((x) => (
        <Card key={x.id}>
          <Label>
            {x.work_date} · {x.shift_type}
          </Label>
          <Label muted>
            {hours(
              metrics(
                x,
                s.breaks.filter((b) => b.shift_id === x.id),
                now,
              ).productive,
            )}{" "}
            / {hours((x.target_minutes + x.buffer_minutes) * 60000)} ·{" "}
            {x.status}
          </Label>
        </Card>
      ))}
    </Page>
  );
}
