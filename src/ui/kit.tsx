import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useFrameCallback,
  runOnJS,
} from "react-native-reanimated";
import { useStore } from "../state/store";
export function useTheme() {
  const accent = useStore((s) => s.settings.accent);
  const preference = useStore((s) => s.settings.theme),
    system = useColorScheme();
  const dark =
    preference === "dark" || (preference === "system" && system !== "light");
  const rgb = [1, 3, 5]
    .map((i) => parseInt(accent.slice(i, i + 2), 16) / 255)
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
  const luminance = rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  const onAccent = luminance > 0.179 ? "#071A19" : "#FFFFFF";
  return {
    dark,
    bg: dark ? "#0F1115" : "#F8F6F1",
    card: dark ? "#171D23" : "#FFFFFF",
    text: dark ? "#F1F4F0" : "#18221E",
    muted: dark ? "#94A19C" : "#63756A",
    line: dark ? "#2B3339" : "#E9E5DD",
    accent,
    onAccent,
    danger: "#F7505E",
    success: dark ? "#34D4AA" : "#009F78",
    cyan: dark ? "#75DCE9" : "#146977",
    orange: "#EDAA66",
    purple: "#AF8DE2",
  };
}
export function Label({
  children,
  size = 14,
  muted = false,
  color,
  weight = false,
}: {
  children: React.ReactNode;
  size?: number;
  muted?: boolean;
  color?: string;
  weight?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontSize: size,
        color: color ?? (muted ? t.muted : t.text),
        fontWeight: weight ? "700" : "400",
        lineHeight: size * 1.4,
      }}
    >
      {children}
    </Text>
  );
}
export function Page({
  title,
  subtitle,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const t = useTheme();
  const inner = (
    <View style={{ padding: 22, gap: 16, flex: scroll ? undefined : 1 }}>
      <Label size={28} weight>
        {title}
      </Label>
      {subtitle && <Label muted>{subtitle}</Label>}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={{
        backgroundColor: t.card,
        padding: 18,
        borderRadius: 22,
        gap: 12,
        borderWidth: 1,
        borderColor: t.line,
      }}
    >
      {children}
    </Animated.View>
  );
}
export function Row({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const t = useTheme(),
    busy = useStore((s) => s.busy);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingVertical: 13,
        paddingHorizontal: 18,
        borderRadius: 15,
        backgroundColor: secondary ? t.line : t.accent,
        opacity: pressed || disabled || busy ? 0.6 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {icon && (
        <Ionicons name={icon} size={18} color={secondary ? t.text : t.bg} />
      )}
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: secondary ? t.text : t.onAccent,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Edit({
  onPress,
  label = "Edit",
}: {
  onPress: () => void;
  label?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ padding: 12, minWidth: 48, minHeight: 48 }}
    >
      <Ionicons name="create-outline" size={22} color={t.cyan} />
    </Pressable>
  );
}
export function Chips<T extends string>({
  values,
  value,
  onChange,
  labels,
}: {
  labels?: Partial<Record<T, string>>;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {values.map((v) => (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: v === value }}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: v === value ? t.accent : t.line,
            }}
          >
            <Text
              style={{
                color: v === value ? t.onAccent : t.text,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {labels?.[v] ?? v.replaceAll("_", " ")}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  secure = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  secure?: boolean;
  multiline?: boolean;
}) {
  const t = useTheme();
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const hasDate = label.includes("YYYY-MM-DD"),
    hasTime = label.includes("HH:mm") || label.includes("THH:mm");
  const parsed = new Date(value);
  const chosen = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  if (!hasDate && /^\d{2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(":").map(Number);
    chosen.setHours(h!, m!, 0, 0);
  }
  return (
    <View style={{ gap: 6 }}>
      <Label muted>{label}</Label>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          keyboardType={numeric ? "decimal-pad" : "default"}
          secureTextEntry={secure}
          multiline={multiline}
          autoCapitalize="none"
          style={{
            flex: 1,
            backgroundColor: t.bg,
            borderColor: t.line,
            borderWidth: 1,
            padding: 14,
            borderRadius: 13,
            color: t.text,
            fontSize: 16,
          }}
        />
        {Platform.OS !== "web" && hasDate && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pick date for ${label}`}
            onPress={() => setPicker("date")}
          >
            <Ionicons name="calendar-outline" color={t.accent} size={24} />
          </Pressable>
        )}
        {Platform.OS !== "web" && hasTime && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pick time for ${label}`}
            onPress={() => setPicker("time")}
          >
            <Ionicons name="time-outline" color={t.accent} size={24} />
          </Pressable>
        )}
      </View>
      {picker && Platform.OS !== "web" && (
        <DateTimePicker
          value={chosen}
          mode={picker}
          display="default"
          onChange={(event, date) => {
            setPicker(null);
            if (event.type === "dismissed" || !date) return;
            const pad = (n: number) => String(n).padStart(2, "0"),
              key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
              time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
            onChange(hasDate ? (hasTime ? `${key}T${time}` : key) : time);
          }}
        />
      )}
    </View>
  );
}
export function useNow() {
  const [now, setNow] = useState(Date.now());
  useFrameCallback((frame) => {
    if (
      Math.floor(frame.timestamp / 1000) !==
      Math.floor((frame.timestamp - (frame.timeSincePreviousFrame ?? 0)) / 1000)
    )
      runOnJS(setNow)(Date.now());
  });
  return now;
}
export function Loading() {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={t.accent} />
    </View>
  );
}
export async function act(action: () => Promise<unknown>, done?: () => void) {
  const ok = await useStore.getState().mutate(action);
  if (ok) done?.();
  else if (useStore.getState().error)
    Alert.alert("Could not save", useStore.getState().error!);
}
