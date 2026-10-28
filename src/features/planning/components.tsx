import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Switch, View } from "react-native";
import { useStore } from "../../state/store";
import { Button, Card, Chips, Label, Row, useTheme } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
export function Money({
  minor,
  large = false,
  hidden = false,
  color,
}: {
  minor: number;
  large?: boolean;
  hidden?: boolean;
  color?: string;
}) {
  const code = useStore((s) => s.settings.currency);
  return (
    <Label size={large ? 32 : 16} color={color} weight>
      {hidden
        ? "••••••"
        : new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: code,
            maximumFractionDigits: 2,
          }).format(minor / 100)}
    </Label>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        height: 7,
        borderRadius: 8,
        backgroundColor: t.line,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          height: 7,
          backgroundColor: color ?? t.accent,
          borderRadius: 8,
        }}
      />
    </View>
  );
}
export function Tile({
  title,
  subtitle,
  icon = "chevron-forward",
  onPress,
  right,
  color,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  right?: React.ReactNode;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      <Card>
        <Row>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: (color ?? t.accent) + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={21} color={color ?? t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Label weight>{title}</Label>
            {subtitle && (
              <Label muted size={12}>
                {subtitle}
              </Label>
            )}
          </View>
          {right ?? (
            <Ionicons name="chevron-forward" color={t.muted} size={18} />
          )}
        </Row>
      </Card>
    </Pressable>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  const t = useTheme();
  return (
    <Row>
      <View style={{ flex: 1 }}>
        <Label weight>{label}</Label>
        {description && (
          <Label muted size={12}>
            {description}
          </Label>
        )}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.accent }}
      />
    </Row>
  );
}
export function AccountChoice({
  value,
  onChange,
  optional = false,
}: {
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  const accounts = useStore((s) => s.accounts);
  const nav = useNav();
  if (!accounts.length)
    return (
      <Button
        title="Create an account"
        onPress={() => nav.navigate("Accounts")}
      />
    );
  return (
    <Chips
      values={[...(optional ? [""] : []), ...accounts.map((a) => a.id)]}
      labels={{
        "": "No transfer",
        ...Object.fromEntries(accounts.map((a) => [a.id, a.name])),
      }}
      value={value}
      onChange={onChange}
    />
  );
}
export function CategoryChoice({
  value,
  onChange,
  kind = "BOTH",
}: {
  value: string;
  onChange: (v: string) => void;
  kind?: string;
}) {
  const nav = useNav();
  const categories = useStore((s) => s.categories);
  const list = categories.filter(
    (c) =>
      c.is_active && (kind === "BOTH" || c.kind === kind || c.kind === "BOTH"),
  );
  return (
    <View style={{ gap: 12 }}>
      <Chips
        values={["", ...list.map((c) => c.id)]}
        labels={{
          "": "Uncategorized",
          ...Object.fromEntries(list.map((c) => [c.id, c.name])),
        }}
        value={value}
        onChange={onChange}
      />
      <Button
        title="Manage categories"
        secondary
        onPress={() => nav.navigate("Categories")}
      />
    </View>
  );
}
export function WeekdayChoice({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
        <Button
          key={day}
          title={day}
          secondary={!(value & (1 << i))}
          onPress={() => onChange(value ^ (1 << i))}
        />
      ))}
    </View>
  );
}
