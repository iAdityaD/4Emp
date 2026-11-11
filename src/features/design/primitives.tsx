import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Card, Label, Row, useTheme } from "../../ui/kit";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function IconButton({
  icon,
  label,
  onPress,
  color,
  filled = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  filled?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: filled ? t.accent : t.line,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? t.accent : t.inset,
        opacity: pressed || disabled ? 0.5 : 1,
      })}
    >
      <Ionicons
        name={icon}
        size={21}
        color={color ?? (filled ? t.onAccent : t.text)}
      />
    </Pressable>
  );
}
export function InfoButton({ title, text }: { title: string; text: string }) {
  return (
    <IconButton
      icon="information-circle-outline"
      label={`About ${title}`}
      onPress={() => Alert.alert(title, text)}
    />
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Row>
      <View
        accessibilityRole="header"
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <View
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            backgroundColor: t.accent,
          }}
        />
        <Label size={16} weight>
          {title}
        </Label>
      </View>
      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          hitSlop={8}
          style={{ paddingVertical: 12, paddingHorizontal: 4 }}
        >
          <Label color={t.accentInk} size={12} weight>
            {action}
          </Label>
        </Pressable>
      )}
    </Row>
  );
}
export function MenuRow({
  title,
  icon,
  value,
  onPress,
  color,
  trailing,
}: {
  title: string;
  icon: IconName;
  value?: string;
  onPress: () => void;
  color?: string;
  trailing?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 13,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: (color ?? t.accent) + "1F",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} color={color ?? t.accentInk} size={20} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Label weight>{title}</Label>
          {value && (
            <Label muted size={12}>
              {value}
            </Label>
          )}
        </View>
        {trailing ?? (
          <Ionicons name="chevron-forward" color={t.muted} size={16} />
        )}
      </View>
    </Pressable>
  );
}
export function ActionDock({
  actions,
}: {
  actions: {
    label: string;
    icon: IconName;
    color?: string;
    onPress: () => void;
  }[];
}) {
  const t = useTheme();
  return (
    <View
      style={{ flexDirection: "row", justifyContent: "space-around", gap: 8 }}
    >
      {actions.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={a.onPress}
          style={({ pressed }) => ({
            alignItems: "center",
            gap: 8,
            flex: 1,
            opacity: pressed ? 0.6 : 1,
            paddingVertical: 5,
          })}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: (a.color ?? t.accent) + "59",
              backgroundColor: (a.color ?? t.accent) + "1F",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={a.icon} color={a.color ?? t.accentInk} size={23} />
          </View>
          <Label size={11} weight>
            {a.label}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
export function FeatureCard({
  title,
  icon,
  value,
  caption,
  color,
  onPress,
}: {
  title: string;
  icon: IconName;
  value?: string;
  caption?: string;
  color?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ width: "47%", opacity: pressed ? 0.7 : 1 })}
    >
      <Card>
        <Row>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              backgroundColor: (color ?? t.accent) + "1F",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} color={color ?? t.accentInk} size={23} />
          </View>
          <Ionicons name="arrow-forward-outline" size={16} color={t.muted} />
        </Row>
        <Label weight>{title}</Label>
        {value && (
          <Label size={21} weight>
            {value}
          </Label>
        )}
        {caption && (
          <Label muted size={11}>
            {caption}
          </Label>
        )}
      </Card>
    </Pressable>
  );
}
export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false),
    t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((x) => !x)}
      >
        <Row>
          <Label muted size={12}>
            {title}
          </Label>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={t.muted}
          />
        </Row>
      </Pressable>
      {open && children}
    </View>
  );
}
