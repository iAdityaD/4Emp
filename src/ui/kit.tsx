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
  const preference = useStore((s) => s.settings.theme),
    system = useColorScheme();
  const dark =
    preference === "dark" || (preference === "system" && system !== "light");
  return {
    dark,
    bg: dark ? "#0F1115" : "#F4F6F2",
    card: dark ? "#191D24" : "#FFFFFF",
    text: dark ? "#F1F4F0" : "#18221E",
    muted: dark ? "#94A19C" : "#63756A",
    line: dark ? "#2B3339" : "#DDE5DC",
    accent: dark ? "#A8F07A" : "#376922",
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
          color: secondary ? t.text : t.bg,
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
}: {
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
                color: v === value ? t.bg : t.text,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {v.replaceAll("_", " ")}
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
  return (
    <View style={{ gap: 6 }}>
      <Label muted>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        secureTextEntry={secure}
        multiline={multiline}
        autoCapitalize="none"
        style={{
          backgroundColor: t.bg,
          borderColor: t.line,
          borderWidth: 1,
          padding: 14,
          borderRadius: 13,
          color: t.text,
          fontSize: 16,
        }}
      />
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
