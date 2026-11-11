import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useSegments } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  runOnJS,
  useFrameCallback,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../state/store";
import { palette } from "../features/design/theme";
/** Fixed-width digits keep timers and readouts from shifting as they tick. */
export const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});
export function useTheme() {
  const accent = useStore((s) => s.settings.accent);
  const preference = useStore((s) => s.settings.theme),
    system = useColorScheme();
  const dark =
    preference === "dark" || (preference === "system" && system !== "light");
  return useMemo(() => palette(dark, accent), [dark, accent]);
}
/** Decorative HUD corner brackets for panels. Hidden from assistive tech. */
export function Brackets({
  color,
  size = 16,
}: {
  color: string;
  size?: number;
}) {
  const edge = { position: "absolute" as const, width: size, height: size };
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <View
        style={{
          ...edge,
          top: -1,
          left: -1,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderTopLeftRadius: 16,
          borderColor: color,
        }}
      />
      <View
        style={{
          ...edge,
          bottom: -1,
          right: -1,
          borderBottomWidth: 2,
          borderRightWidth: 2,
          borderBottomRightRadius: 16,
          borderColor: color,
        }}
      />
    </View>
  );
}
export function Label({
  children,
  size = 14,
  muted = false,
  color,
  weight = false,
  mono = false,
}: {
  children: React.ReactNode;
  size?: number;
  muted?: boolean;
  color?: string;
  weight?: boolean;
  /** Fixed-width digits for timers and other live readouts. */
  mono?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontSize: size,
        color: color ?? (muted ? t.muted : t.text),
        fontWeight: weight ? "700" : "400",
        lineHeight: size * 1.4,
        ...(mono ? { fontFamily: monoFont } : null),
        ...(weight && size >= 20 ? { letterSpacing: 0.3 } : null),
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
  trailing,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  trailing?: React.ReactNode;
}) {
  const t = useTheme(),
    router = useRouter(),
    segments = useSegments();
  const showBack =
    segments.length > 0 && segments[0] !== "(tabs)" && router.canGoBack();
  const inner = (
    <View style={{ padding: 22, gap: 16, flex: scroll ? undefined : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {showBack && (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: t.line,
              backgroundColor: t.inset,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="arrow-back" size={21} color={t.accentInk} />
          </Pressable>
        )}
        <View style={{ flex: 1 }} accessibilityRole="header">
          <Label size={28} weight>
            {title}
          </Label>
        </View>
        {trailing}
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <View
          style={{
            width: 28,
            height: 3,
            borderRadius: 2,
            backgroundColor: t.accent,
          }}
        />
        <View
          style={{
            width: 6,
            height: 3,
            borderRadius: 2,
            backgroundColor: t.glow,
          }}
        />
        <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
      </View>
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
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: t.line,
      }}
    >
      <Brackets color={t.glow} />
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
  selected,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Set for buttons that act as on/off choices so the state is announced. */
  selected?: boolean;
}) {
  const t = useTheme(),
    busy = useStore((s) => s.busy);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled || busy,
        busy,
        ...(selected === undefined ? null : { selected }),
      }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingVertical: 13,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: secondary ? t.line : t.accent,
        backgroundColor: secondary ? t.inset : t.accent,
        opacity: pressed || disabled || busy ? 0.6 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={18}
          color={secondary ? t.text : t.onAccent}
        />
      )}
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          letterSpacing: 0.4,
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
  const t = useTheme(),
    { fontScale } = useWindowDimensions();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{
        flexGrow: 0,
        flexShrink: 0,
        height: Math.max(44, Math.ceil(12 * fontScale * 1.4 + 26)),
      }}
      contentContainerStyle={{ alignItems: "center" }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {values.map((v) => (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: v === value }}
            style={{
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: v === value ? t.accent : t.line,
              backgroundColor: v === value ? t.accent : t.inset,
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
  picker: pickerType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  secure?: boolean;
  multiline?: boolean;
  picker?: "date" | "time" | "datetime";
}) {
  const t = useTheme();
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const hasDate =
      pickerType === "date" ||
      pickerType === "datetime" ||
      label.includes("YYYY-MM-DD"),
    hasTime =
      pickerType === "time" ||
      pickerType === "datetime" ||
      label.includes("HH:mm") ||
      label.includes("THH:mm");
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
            backgroundColor: t.inset,
            borderColor: t.line,
            borderWidth: 1,
            padding: 14,
            borderRadius: 12,
            color: t.text,
            fontSize: 16,
          }}
          placeholderTextColor={t.muted}
          selectionColor={t.accent}
        />
        {Platform.OS !== "web" && hasDate && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pick date for ${label}`}
            onPress={() => setPicker("date")}
            hitSlop={10}
          >
            <Ionicons name="calendar-outline" color={t.accentInk} size={24} />
          </Pressable>
        )}
        {Platform.OS !== "web" && hasTime && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pick time for ${label}`}
            onPress={() => setPicker("time")}
            hitSlop={10}
          >
            <Ionicons name="time-outline" color={t.accentInk} size={24} />
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
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your data"
      style={{
        flex: 1,
        backgroundColor: t.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          borderWidth: 1,
          borderColor: t.glow,
          backgroundColor: t.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={t.accentInk} />
      </View>
    </View>
  );
}
export async function act(action: () => Promise<unknown>, done?: () => void) {
  const ok = await useStore.getState().mutate(action);
  if (ok) done?.();
  else if (useStore.getState().error)
    Alert.alert("Could not save", useStore.getState().error!);
}
