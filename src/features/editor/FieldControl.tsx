import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { cents } from "../../domain/finance";
import { dateKey, localDate } from "../../domain/shift";
import { Label, Row, useTheme } from "../../ui/kit";
import {
  ColorPicker,
  DurationControl,
  IconPicker,
  TermControl,
} from "../design/controls";
import {
  AccountChoice,
  CategoryChoice,
  Toggle,
  WeekdayChoice,
} from "../planning/components";
import { Data, FieldSpec } from "./model";
const labels: Record<string, string> = {
  GROSS: "Elapsed time",
  NET: "Working time",
  WORKDAYS: "Workdays",
  DAYS_OFF: "Leave & days off",
  OFFICE: "Work",
  WFH: "Home",
  HALF_DAY: "Half day",
  CUSTOM: "Focus timer",
  OPEN_ENDED: "Stopwatch",
  BALANCE: "Current balance",
  MONTHLY_SAVINGS: "This month’s savings",
  CONTRIBUTIONS: "Manual contributions",
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
  BOTH: "Both",
  BANK: "Bank",
  CASH: "Cash",
  WALLET: "Wallet",
  DAY: "Days",
  WEEK: "Weeks",
  MONTH: "Months",
  YEAR: "Years",
  system: "System",
  light: "Light",
  dark: "Dark",
};
export function FieldControl({
  spec,
  value,
  onChange,
  data,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  data?: Data;
}) {
  const t = useTheme(),
    [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [text, setText] = useState(() =>
    spec.type === "money" || spec.type === "signedMoney"
      ? Number(value)
        ? String(Number(value) / 100)
        : ""
      : spec.type === "percent"
        ? String(Number(value) / 100)
        : String(value ?? ""),
  );
  if (spec.type === "tenure")
    return <TermControl value={Number(value) || 0} onChange={onChange} />;
  if (spec.type === "duration")
    return <DurationControl value={Number(value) || 0} onChange={onChange} />;
  if (spec.type === "color")
    return (
      <ColorPicker value={String(value ?? "#00A88A")} onChange={onChange} />
    );
  if (spec.type === "icon")
    return <IconPicker value={String(value)} onChange={onChange} />;
  if (spec.type === "weekdays")
    return <WeekdayChoice value={Number(value)} onChange={onChange} />;
  if (spec.type === "toggle")
    return (
      <Toggle
        label={spec.label}
        value={!!value}
        onChange={(v) => onChange(typeof value === "number" ? (v ? 1 : 0) : v)}
      />
    );
  if (spec.type === "account")
    return (
      <AccountChoice
        value={String(value ?? "")}
        onChange={onChange}
        optional={spec.optional}
      />
    );
  if (spec.type === "category")
    return (
      <CategoryChoice
        kind={
          data?.type === "INCOME" || data?.__kind === "salary"
            ? "INCOME"
            : data?.kind === "INCOME"
              ? "INCOME"
              : "EXPENSE"
        }
        value={String(value ?? "")}
        onChange={onChange}
      />
    );
  if (spec.type === "choice")
    return (
      <View style={{ gap: 10 }}>
        {(spec.options ?? []).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option }}
            accessibilityLabel={
              spec.key === "payment_type" && option === "TRANSFER"
                ? "Investment transfer"
                : (labels[option] ?? option)
            }
            onPress={() => onChange(option)}
            style={{
              padding: 18,
              borderRadius: 18,
              backgroundColor: value === option ? t.accent + "18" : t.card,
              borderWidth: 1,
              borderColor: value === option ? t.accent : t.line,
            }}
          >
            <Row>
              <Label weight>
                {spec.key === "payment_type" && option === "TRANSFER"
                  ? "Investment transfer"
                  : (labels[option] ?? option)}
              </Label>
              <Ionicons
                name={value === option ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={value === option ? t.accent : t.muted}
              />
            </Row>
          </Pressable>
        ))}
      </View>
    );
  if (["payday", "cycleDay", "due_day_of_month"].includes(spec.key))
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <Pressable
            key={day}
            accessibilityLabel={`Day ${day}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === day }}
            onPress={() => onChange(day)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: value === day ? t.accent : t.card,
            }}
          >
            <Label color={value === day ? t.onAccent : t.text}>{day}</Label>
          </Pressable>
        ))}
      </View>
    );
  if (["date", "time", "datetime", "month"].includes(spec.type)) {
    const isTime = spec.type === "time",
      isMonth = spec.type === "month";
    let d = isTime
      ? new Date()
      : value
        ? spec.type === "date"
          ? localDate(String(value))
          : isMonth
            ? localDate(String(value) + "-01")
            : new Date(String(value))
        : new Date();
    if (isTime) {
      const n = Number(value) || 0;
      d.setHours(Math.floor(n / 60), n % 60, 0, 0);
    }
    const showTime = isTime || spec.type === "datetime";
    const choose = (mode: "date" | "time") => setPicker(mode);
    return (
      <View style={{ gap: 14 }}>
        {!isTime && (
          <Pressable
            accessibilityLabel={`Choose ${spec.label}`}
            accessibilityRole="button"
            onPress={() => choose("date")}
            style={{
              padding: 24,
              borderRadius: 22,
              backgroundColor: t.card,
              alignItems: "center",
              gap: 12,
            }}
          >
            <Ionicons name="calendar-outline" size={32} color={t.accent} />
            <Label size={26} weight>
              {value
                ? d.toLocaleDateString([], {
                    day: isMonth ? undefined : "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Choose date"}
            </Label>
          </Pressable>
        )}
        {showTime && (
          <Pressable
            accessibilityLabel="Choose time"
            accessibilityRole="button"
            onPress={() => choose("time")}
            style={{
              padding: 28,
              borderRadius: 22,
              backgroundColor: t.card,
              alignItems: "center",
              gap: 12,
            }}
          >
            <Ionicons name="time-outline" size={32} color={t.accent} />
            <Label size={38} weight>
              {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Label>
          </Pressable>
        )}
        {spec.optional && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange(null)}
            style={{ padding: 14, alignItems: "center" }}
          >
            <Label muted>
              {spec.key === "deadline" ? "No deadline" : "Not set"}
            </Label>
          </Pressable>
        )}
        {picker && Platform.OS !== "web" && (
          <DateTimePicker
            value={Number.isFinite(d.getTime()) ? d : new Date()}
            mode={picker}
            display="default"
            onChange={(e, next) => {
              setPicker(null);
              if (e.type === "dismissed" || !next) return;
              if (isTime) onChange(next.getHours() * 60 + next.getMinutes());
              else if (spec.type === "datetime") onChange(next.toISOString());
              else
                onChange(isMonth ? dateKey(next).slice(0, 7) : dateKey(next));
            }}
          />
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: 16 }}>
      <TextInput
        accessibilityLabel={spec.label}
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (spec.type === "money" || spec.type === "signedMoney") {
            const n = Number(v);
            onChange(
              v
                ? Number.isFinite(n) && Math.abs(n) <= 9e10
                  ? cents(n)
                  : NaN
                : 0,
            );
          } else if (spec.type === "number") onChange(Number(v));
          else if (spec.type === "percent")
            onChange(Math.round(Number(v) * 100));
          else onChange(v);
        }}
        keyboardType={
          spec.type === "signedMoney"
            ? "numeric"
            : ["money", "number", "percent"].includes(spec.type)
              ? "decimal-pad"
              : "default"
        }
        multiline={["note", "notes", "message"].includes(spec.key)}
        autoFocus
        autoCorrect={false}
        autoCapitalize={spec.key === "currency" ? "characters" : "sentences"}
        placeholder={spec.type === "money" ? "0" : spec.label}
        placeholderTextColor={t.muted}
        style={{
          padding: 24,
          fontSize: spec.type === "money" || spec.type === "percent" ? 38 : 23,
          color: t.text,
          backgroundColor: t.card,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: t.line,
        }}
      />
      {spec.type === "percent" && <Label muted>Annual rate · %</Label>}
      {spec.key === "remind_days" && (
        <Label muted>Days before the due date</Label>
      )}
    </View>
  );
}
