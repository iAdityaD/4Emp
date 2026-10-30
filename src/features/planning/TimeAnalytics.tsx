import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Rect, G, Text as SVGText } from "react-native-svg";
import { dateKey, localDate, hours, clock } from "../../domain/shift";
import { dailyTimeSeries, sessionDayMillis } from "../../domain/timeAnalytics";
import { isFocus } from "../../domain/workModes";
import { useStore } from "../../state/store";
import { Card, Label, Page, Row, Button, useNow, useTheme } from "../../ui/kit";
import { MenuRow, InfoButton } from "../design/primitives";
import { useNav } from "../../ui/navigation";
function monday(day: string) {
  const d = localDate(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}
export function TimeAnalyticsScreen() {
  const s = useStore(),
    t = useTheme(),
    now = useNow(),
    nav = useNav();
  const [start, setStart] = useState(() => monday(dateKey())),
    [selected, setSelected] = useState(dateKey());
  const rows = dailyTimeSeries(s.shifts, s.breaks, start, 7, now),
    day = rows.find((r) => r.day === selected) ?? rows[0]!;
  const max = Math.max(3600000, ...rows.flatMap((r) => [r.work, r.focus]));
  const move = (n: number) => {
    const d = localDate(start);
    d.setDate(d.getDate() + n * 7);
    const key = dateKey(d);
    setStart(key);
    setSelected(key);
  };
  const sessions = s.shifts.filter(
    (x) => sessionDayMillis(x, s.breaks, day.day, now) > 0,
  );
  return (
    <Page
      title="Work & focus"
      trailing={
        <InfoButton
          title="Daily analytics"
          text="Hours are split by calendar day. Focus excludes pauses and can overlap work; the two totals are kept separate."
        />
      }
    >
      <Row>
        <Button title="‹" secondary onPress={() => move(-1)} />
        <Label weight>
          {localDate(start).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}{" "}
          –{" "}
          {localDate(rows[6]!.day).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}
        </Label>
        <Button title="›" secondary onPress={() => move(1)} />
      </Row>
      <Card>
        <Row>
          <View>
            <Label muted>Work this week</Label>
            <Label size={23} weight color={t.accent}>
              {hours(rows.reduce((n, r) => n + r.work, 0))}
            </Label>
          </View>
          <View>
            <Label muted>Focus this week</Label>
            <Label size={23} weight color={t.cyan}>
              {hours(rows.reduce((n, r) => n + r.focus, 0))}
            </Label>
          </View>
        </Row>
        <Svg
          accessibilityLabel="Daily work and focus hours"
          viewBox="0 0 350 180"
          width="100%"
          height={180}
        >
          {rows.map((r, i) => (
            <G key={r.day} onPress={() => setSelected(r.day)}>
              <Rect
                x={i * 50 + 8}
                y={145 - (r.work / max) * 120}
                width={13}
                height={(r.work / max) * 120}
                rx={5}
                fill={t.accent}
              />
              <Rect
                x={i * 50 + 25}
                y={145 - (r.focus / max) * 120}
                width={13}
                height={(r.focus / max) * 120}
                rx={5}
                fill={t.cyan}
              />
              <SVGText
                x={i * 50 + 23}
                y={168}
                textAnchor="middle"
                fill={t.muted}
                fontSize={11}
              >
                {localDate(r.day).toLocaleDateString([], { weekday: "short" })}
              </SVGText>
            </G>
          ))}
        </Svg>
        <Row>
          {rows.map((r) => (
            <Pressable
              key={r.day}
              accessibilityRole="button"
              accessibilityLabel={`View ${r.day}`}
              onPress={() => setSelected(r.day)}
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: r.day === day.day ? t.accent + "22" : t.bg,
              }}
            >
              <Label size={12}>{localDate(r.day).getDate()}</Label>
            </Pressable>
          ))}
        </Row>
      </Card>
      <Label weight>
        {localDate(day.day).toLocaleDateString([], {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
      </Label>
      <Card>
        <Row>
          <Label color={t.accent}>Work</Label>
          <Label weight>{hours(day.work)}</Label>
        </Row>
        <Row>
          <Label color={t.cyan}>Focus</Label>
          <Label weight>{hours(day.focus)}</Label>
        </Row>
      </Card>
      {sessions.map((x) => (
        <Card key={x.id}>
          <MenuRow
            title={isFocus(x.shift_type) ? "Focus" : "Work"}
            icon={isFocus(x.shift_type) ? "timer-outline" : "briefcase-outline"}
            value={`${clock(x.first_swipe_in)} – ${x.last_swipe_out ? clock(x.last_swipe_out) : x.status === "NEEDS_REVIEW" ? "Review needed" : "Running"}`}
            trailing={
              <Label>
                {hours(sessionDayMillis(x, s.breaks, day.day, now))}
              </Label>
            }
            onPress={() => nav.navigate("ShiftDetails", { shiftId: x.id })}
          />
        </Card>
      ))}
      {!sessions.length && <Label muted>No time logged</Label>}
    </Page>
  );
}
