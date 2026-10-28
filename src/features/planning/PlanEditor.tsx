import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";
import { cents, parseAmount } from "../../domain/finance";
import { parseClock } from "./WorkSettings";
import { dateKey } from "../../domain/shift";
import {
  PlanKind,
  PlanningRepository,
} from "../../repositories/PlanningRepository";
import { useStore } from "../../state/store";
import { Button, Card, Chips, Field, Label, Page, act } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { suggestedEMI } from "./calculations";
import {
  AccountChoice,
  CategoryChoice,
  Toggle,
  WeekdayChoice,
} from "./components";
type Spec = {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "money"
    | "percent"
    | "date"
    | "account"
    | "category"
    | "toggle"
    | "choice"
    | "time"
    | "weekdays";
  options?: string[];
};
const f = (
  key: string,
  label: string,
  type: Spec["type"],
  options?: string[],
): Spec => ({ key, label, type, options });
const common = [
  f("title", "Name", "text"),
  f("account_id", "Payment account", "account"),
  f("category_id", "Category", "category"),
];
export const editorSpecs: Record<
  PlanKind,
  { title: string; hint: string; fields: Spec[] }
> = {
  salary: {
    title: "Salary rule",
    hint: "Auto-posting creates actual income on or after payday, once per occurrence. Start date controls catch-up; use today to avoid historical entries.",
    fields: [
      ...common,
      f("amount_minor", "Net salary", "money"),
      f("payday", "Payday (1–31; snaps to month end)", "number"),
      f("start_date", "Start date · YYYY-MM-DD", "date"),
      f("auto_post", "Automatically record salary", "toggle"),
      f("remind_days", "Remind days before payday", "number"),
      f("is_active", "Active", "toggle"),
    ],
  },
  recurring: {
    title: "Recurring transaction",
    hint: "Automatic entries are created from the anchor date through today. Reopening never creates duplicates. A reminder-only rule waits for you to record each occurrence.",
    fields: [
      ...common,
      f("type", "Entry type", "choice", ["EXPENSE", "INCOME", "TRANSFER"]),
      f("amount_minor", "Amount", "money"),
      f("destination_account_id", "Transfer destination", "account"),
      f("anchor_date", "First occurrence · YYYY-MM-DD", "date"),
      f("interval_count", "Repeat every", "number"),
      f("interval_unit", "Interval", "choice", [
        "DAY",
        "WEEK",
        "MONTH",
        "YEAR",
      ]),
      f("auto_post", "Automatically record entries", "toggle"),
      f("is_active", "Active", "toggle"),
    ],
  },
  loans: {
    title: "Loan / EMI",
    hint: "Reducing-balance amortization. Principal and interest are shown separately. Enter an existing loan’s outstanding principal to track the remaining tenure. Creating a loan does not invent a bank deposit.",
    fields: [
      ...common,
      f("principal_minor", "Outstanding principal", "money"),
      f("annual_rate_bps", "Annual interest (%)", "percent"),
      f("tenure_months", "Remaining tenure (months)", "number"),
      f("emi_minor", "Monthly EMI · calculate if empty", "money"),
      f("first_due_date", "First due date · YYYY-MM-DD", "date"),
      f("remind_days", "Remind days before due", "number"),
      f("is_active", "Active", "toggle"),
    ],
  },
  subscriptions: {
    title: "Subscription",
    hint: "Each renewal uses the original anchor date. Monthly bills on the 31st snap to February end, then return to the 31st in March.",
    fields: [
      ...common,
      f("amount_minor", "Renewal amount", "money"),
      f("anchor_date", "First tracked renewal · YYYY-MM-DD", "date"),
      f("interval_count", "Repeat every", "number"),
      f("interval_unit", "Billing interval", "choice", [
        "DAY",
        "WEEK",
        "MONTH",
        "YEAR",
      ]),
      f("remind_days", "Remind days before renewal", "number"),
      f("is_active", "Active", "toggle"),
    ],
  },
  budgets: {
    title: "Monthly budget",
    hint: "Budgets count personal expenses, excluding transfers, balance corrections and employer-reimbursable spending. Create separate limits for each month.",
    fields: [
      f("category_id", "Expense category", "category"),
      f("month", "Budget month · YYYY-MM", "text"),
      f("limit_minor", "Monthly limit", "money"),
      f("alert_percent", "Alert at % of limit", "number"),
    ],
  },
  goals: {
    title: "Savings goal",
    hint: "Goal contributions reserve money you already own. They do not count as expenses or new income.",
    fields: [
      f("title", "Goal name", "text"),
      f("target_minor", "Target amount", "money"),
      f("deadline", "Deadline · YYYY-MM-DD (optional)", "date"),
      f("color_hex", "Progress color · #RRGGBB", "text"),
      f("is_active", "Active", "toggle"),
    ],
  },
  profiles: {
    title: "Work profile",
    hint: "Save reusable settings for different workplaces or days. Applying a profile sets your defaults; active and past shifts keep their snapshots.",
    fields: [
      f("title", "Profile name", "text"),
      f("target_minutes", "Full-day baseline minutes", "number"),
      f("buffer_minutes", "Safety buffer minutes", "number"),
      f("tracking_mode", "Tracking method", "choice", ["GROSS", "NET"]),
      f("shift_type", "Shift type", "choice", [
        "OFFICE",
        "WFH",
        "HALF_DAY",
        "CUSTOM",
        "OPEN_ENDED",
      ]),
      f("cutoff_minute", "Day reset · HH:mm", "time"),
      f("weekdays", "Working days", "weekdays"),
    ],
  },
};
export function PlanEditorScreen() {
  const p = useLocalSearchParams<{ kind: PlanKind; id?: string }>(),
    s = useStore(),
    nav = useNav();
  const kind = Object.prototype.hasOwnProperty.call(editorSpecs, p.kind)
    ? p.kind
    : "salary";
  const source = s[kind as keyof typeof s] as unknown;
  const existing = Array.isArray(source)
    ? source.find((r: { id: string }) => r.id === p.id)
    : undefined;
  const defaults: Record<string, string | number | null> = {
    title: "",
    account_id: s.accounts[0]?.id ?? "",
    category_id: "",
    amount_minor: 0,
    payday: new Date().getDate(),
    start_date: dateKey(),
    anchor_date: dateKey(),
    interval_count: 1,
    interval_unit: "MONTH",
    auto_post: 0,
    is_active: 1,
    remind_days: 3,
    principal_minor: 0,
    annual_rate_bps: 0,
    tenure_months: 12,
    emi_minor: 0,
    first_due_date: dateKey(),
    month: dateKey().slice(0, 7),
    limit_minor: 0,
    alert_percent: 80,
    target_minor: 0,
    deadline: "",
    color_hex: s.settings.accent,
    type: "EXPENSE",
    destination_account_id: "",
    target_minutes: s.settings.baseline,
    buffer_minutes: s.settings.buffer,
    tracking_mode: s.settings.mode,
    shift_type: "OFFICE",
    cutoff_minute: s.settings.cutoff,
    weekdays: 127 ^ s.settings.weekends,
  };
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      editorSpecs[kind].fields.map((f) => {
        const v = existing?.[f.key] ?? defaults[f.key] ?? "";
        return [
          f.key,
          f.type === "money"
            ? Number(v)
              ? String(Number(v) / 100)
              : ""
            : f.type === "time"
              ? `${String(Math.floor(Number(v) / 60)).padStart(2, "0")}:${String(Number(v) % 60).padStart(2, "0")}`
              : f.type === "percent"
                ? String(Number(v) / 100)
                : String(v),
        ];
      }),
    ),
  );
  const change = (k: string, v: string) => setRaw((r) => ({ ...r, [k]: v }));
  const save = () =>
    void act(
      async () => {
        const data: Record<string, unknown> = {};
        for (const f of editorSpecs[kind].fields) {
          const v = raw[f.key] ?? "";
          data[f.key] =
            f.type === "money"
              ? cents(parseAmount(v))
              : f.type === "time"
                ? parseClock(v)
                : f.type === "percent"
                  ? Math.round(Number(v) * 100)
                  : ["number", "toggle", "weekdays"].includes(f.type)
                    ? Number(v)
                    : f.key === "deadline" ||
                        f.type === "category" ||
                        f.key === "destination_account_id"
                      ? v || null
                      : v;
        }
        await PlanningRepository.save(kind, data, p.id);
      },
      () => nav.goBack(),
    );
  return (
    <Page
      title={
        p.id
          ? `Edit ${editorSpecs[kind].title.toLowerCase()}`
          : editorSpecs[kind].title
      }
      subtitle={editorSpecs[kind].hint}
    >
      <Card>
        {editorSpecs[kind].fields
          .filter(
            (f) =>
              f.key !== "destination_account_id" || raw.type === "TRANSFER",
          )
          .map((f) => (
            <React.Fragment key={f.key}>
              {f.type === "account" ? (
                <>
                  <Label muted>{f.label}</Label>
                  <AccountChoice
                    value={raw[f.key] ?? ""}
                    onChange={(v) => change(f.key, v)}
                  />
                </>
              ) : f.type === "category" ? (
                <>
                  <Label muted>{f.label}</Label>
                  <CategoryChoice
                    kind={
                      kind === "salary" ? "INCOME" : (raw.type ?? "EXPENSE")
                    }
                    value={raw[f.key] ?? ""}
                    onChange={(v) => change(f.key, v)}
                  />
                </>
              ) : f.type === "weekdays" ? (
                <>
                  <Label muted>{f.label}</Label>
                  <WeekdayChoice
                    value={Number(raw[f.key])}
                    onChange={(v) => change(f.key, String(v))}
                  />
                </>
              ) : f.type === "toggle" ? (
                <Toggle
                  label={f.label}
                  value={raw[f.key] === "1"}
                  onChange={(v) => change(f.key, v ? "1" : "0")}
                />
              ) : f.type === "choice" ? (
                <>
                  <Label muted>{f.label}</Label>
                  <Chips
                    values={f.options ?? []}
                    value={raw[f.key] ?? ""}
                    onChange={(v) => change(f.key, v)}
                  />
                </>
              ) : (
                <Field
                  label={f.label}
                  value={raw[f.key] ?? ""}
                  onChange={(v) => change(f.key, v)}
                  numeric={["money", "number", "percent"].includes(f.type)}
                />
              )}
            </React.Fragment>
          ))}
        {kind === "loans" && (
          <Button
            title="Calculate suggested EMI"
            secondary
            onPress={() => {
              try {
                const emi = suggestedEMI(
                  cents(parseAmount(raw.principal_minor ?? "")),
                  Math.round(Number(raw.annual_rate_bps) * 100),
                  Number(raw.tenure_months),
                );
                if (!Number.isFinite(emi) || emi <= 0)
                  throw Error("Enter principal, rate and tenure first");
                change("emi_minor", String(emi / 100));
              } catch (e) {
                Alert.alert("Check loan", String(e));
              }
            }}
          />
        )}
        <Button title="Save" onPress={save} />
      </Card>
      {p.id && (
        <Button
          secondary
          title={kind === "budgets" ? "Delete budget" : "Archive"}
          onPress={() =>
            Alert.alert(
              "Archive this record?",
              "Existing transactions and payment history stay in your ledger.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Confirm",
                  style: "destructive",
                  onPress: () =>
                    void act(
                      () => PlanningRepository.archive(kind, p.id!),
                      () => nav.goBack(),
                    ),
                },
              ],
            )
          }
        />
      )}
    </Page>
  );
}
