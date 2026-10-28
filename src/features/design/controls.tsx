import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  GestureResponderEvent,
  Pressable,
  TextInput,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Label, Row, useTheme } from "../../ui/kit";
import { hexToHSV, hsvToHex, parseDuration } from "./color";
import { IconName } from "./primitives";
export function DurationControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTheme();
  const [hours, setHours] = useState(String(Math.floor(value / 60))),
    [minutes, setMinutes] = useState(String(value % 60));
  const edit = (h: string, m: string) => {
    setHours(h);
    setMinutes(m);
    try {
      onChange(parseDuration(h || "0", m || "0"));
    } catch {
      onChange(NaN);
    }
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        paddingVertical: 22,
      }}
    >
      {[
        ["Hours", hours, (s: string) => edit(s, minutes)],
        ["Minutes", minutes, (s: string) => edit(hours, s)],
      ].map(([label, v, change]) => (
        <View key={String(label)} style={{ alignItems: "center", gap: 10 }}>
          <TextInput
            accessibilityLabel={String(label)}
            value={v as string}
            onChangeText={change as (s: string) => void}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            style={{
              width: 112,
              padding: 18,
              fontSize: 38,
              fontWeight: "700",
              textAlign: "center",
              color: t.text,
              backgroundColor: t.card,
              borderColor: t.line,
              borderWidth: 1,
              borderRadius: 22,
            }}
          />
          <Label muted size={12}>
            {String(label)}
          </Label>
        </View>
      ))}
    </View>
  );
}
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [hsv, setHSV] = useState(() => hexToHSV(value)),
    [width, setWidth] = useState(280);
  const t = useTheme();
  useEffect(() => {
    if (value.toUpperCase() !== hsvToHex(hsv.h, hsv.s, hsv.v))
      setHSV(hexToHSV(value));
  }, [value]);
  const change = (next: typeof hsv) => {
    setHSV(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };
  const point = (e: GestureResponderEvent, type: "sv" | "h") => {
    const x = Math.max(0, Math.min(1, e.nativeEvent.locationX / width));
    if (type === "h") change({ ...hsv, h: x * 359.999 });
    else
      change({
        ...hsv,
        s: x,
        v: 1 - Math.max(0, Math.min(1, e.nativeEvent.locationY / 180)),
      });
  };
  const hue = hsvToHex(hsv.h, 1, 1);
  return (
    <View style={{ gap: 20 }}>
      <View
        style={{ height: 180, borderRadius: 20, overflow: "hidden" }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => point(e, "sv")}
        onResponderMove={(e) => point(e, "sv")}
        accessibilityLabel="Saturation and brightness"
        accessibilityHint="Drag horizontally for saturation and vertically for brightness"
      >
        <Svg pointerEvents="none" width="100%" height="100%">
          <Defs>
            <LinearGradient id="saturation">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor={hue} />
            </LinearGradient>
            <LinearGradient id="brightness" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#saturation)" />
          <Rect width="100%" height="100%" fill="url(#brightness)" />
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(width - 20, hsv.s * width - 10)),
            top: Math.max(0, Math.min(160, (1 - hsv.v) * 180 - 10)),
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: "#FFFFFF",
            backgroundColor: value,
          }}
        />
      </View>
      <View
        style={{ height: 30, borderRadius: 15, overflow: "hidden" }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => point(e, "h")}
        onResponderMove={(e) => point(e, "h")}
        accessibilityLabel="Hue"
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.h) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) =>
          change({
            ...hsv,
            h:
              (hsv.h + (e.nativeEvent.actionName === "increment" ? 10 : 350)) %
              360,
          })
        }
      >
        <Svg pointerEvents="none" width="100%" height="100%">
          <Defs>
            <LinearGradient id="hues">
              {[
                "#FF0000",
                "#FFFF00",
                "#00FF00",
                "#00FFFF",
                "#0000FF",
                "#FF00FF",
                "#FF0000",
              ].map((c, i) => (
                <Stop key={i} offset={i / 6} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hues)" />
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(width - 24, (hsv.h / 360) * width - 12)),
            top: 3,
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 3,
            borderColor: "#FFFFFF",
            backgroundColor: hue,
          }}
        />
      </View>
      <Row>
        {[
          "#00A88A",
          "#3B82F6",
          "#A779F5",
          "#F7505E",
          "#E6A23C",
          "#075A62",
          "#F278A4",
          "#64748B",
        ].map((c) => (
          <Pressable
            key={c}
            accessibilityLabel={`Choose color ${c}`}
            accessibilityState={{ selected: value.toUpperCase() === c }}
            onPress={() => {
              setHSV(hexToHSV(c));
              onChange(c);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: c,
              borderWidth: 3,
              borderColor: value.toUpperCase() === c ? t.text : "transparent",
            }}
          />
        ))}
      </Row>
      <Row>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: value,
            borderColor: t.line,
            borderWidth: 1,
          }}
        />
        <Label muted>{value.toUpperCase()}</Label>
      </Row>
    </View>
  );
}
export const categoryIcons: IconName[] = [
  "restaurant-outline",
  "cafe-outline",
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
  "gift-outline",
  "fitness-outline",
  "paw-outline",
];
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {categoryIcons.map((icon) => (
        <Pressable
          key={icon}
          accessibilityRole="button"
          accessibilityLabel={icon.replace("-outline", "")}
          accessibilityState={{ selected: icon === value }}
          onPress={() => onChange(icon)}
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: icon === value ? t.accent : t.card,
            borderColor: t.line,
            borderWidth: 1,
          }}
        >
          <Ionicons
            name={icon}
            size={25}
            color={icon === value ? t.onAccent : t.text}
          />
        </Pressable>
      ))}
    </View>
  );
}
export function TermControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTheme(),
    [years, setYears] = useState(String(Math.floor(value / 12))),
    [months, setMonths] = useState(String(value % 12));
  const edit = (y: string, m: string) => {
    setYears(y);
    setMonths(m);
    onChange(
      /^\d{0,2}$/.test(y) && /^\d{0,2}$/.test(m) && Number(m) < 12
        ? Number(y) * 12 + Number(m)
        : NaN,
    );
  };
  return (
    <Row>
      {[
        ["Years", years, (v: string) => edit(v, months)],
        ["Months", months, (v: string) => edit(years, v)],
      ].map(([label, v, change]) => (
        <View key={String(label)} style={{ alignItems: "center", gap: 10 }}>
          <TextInput
            accessibilityLabel={String(label)}
            value={v as string}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            onChangeText={change as (v: string) => void}
            style={{
              width: 120,
              padding: 22,
              fontSize: 36,
              color: t.text,
              backgroundColor: t.card,
              borderRadius: 22,
              textAlign: "center",
            }}
          />
          <Label muted>{String(label)}</Label>
        </View>
      ))}
    </Row>
  );
}
