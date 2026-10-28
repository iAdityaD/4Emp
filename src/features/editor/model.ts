import { z } from "zod";
import { db, uid } from "../../db/connection";
import { Settings } from "../../domain/models";
import { settingsSchema } from "../../domain/settingsValidation";
import { dateKey } from "../../domain/shift";
import { AccountRepository } from "../../repositories/AccountRepository";
import { CategoryRepository } from "../../repositories/CategoryRepository";
import { CommitmentRepository } from "../../repositories/CommitmentRepository";
import {
  PlanKind,
  PlanningRepository,
  planSchemas,
} from "../../repositories/PlanningRepository";
import { SettingsRepository } from "../../repositories/SettingsRepository";
import { ShiftRepository } from "../../repositories/ShiftRepository";
import {
  Entry,
  TransactionRepository,
} from "../../repositories/TransactionRepository";
import { useEntryOptions } from "../../state/entryOptions";
import { useStore } from "../../state/store";
import { durationText } from "../design/color";
import { IconName } from "../design/primitives";
export type Entity =
  | "plan"
  | "account"
  | "category"
  | "transaction"
  | "settings"
  | "reminder"
  | "worklog"
  | "break"
  | "bill"
  | "entry"
  | "due";
export type Value = string | number | boolean | null;
export type Data = Record<string, unknown>;
export type FieldKind =
  | "text"
  | "money"
  | "signedMoney"
  | "number"
  | "percent"
  | "date"
  | "datetime"
  | "time"
  | "duration"
  | "tenure"
  | "color"
  | "choice"
  | "account"
  | "category"
  | "weekdays"
  | "toggle"
  | "icon"
  | "month";
export interface FieldSpec {
  key: string;
  label: string;
  type: FieldKind;
  icon: IconName;
  options?: string[];
  optional?: boolean;
}
const f = (
  key: string,
  label: string,
  type: FieldKind,
  icon: IconName,
  options?: string[],
  optional = false,
): FieldSpec => ({ key, label, type, icon, options, optional });
const title = f("title", "Name", "text", "text-outline"),
  account = f("account_id", "Account", "account", "wallet-outline"),
  category = f(
    "category_id",
    "Category",
    "category",
    "pricetags-outline",
    undefined,
    true,
  ),
  active = f("is_active", "Active", "toggle", "power-outline"),
  amount = f("amount_minor", "Amount", "money", "cash-outline"),
  lead = f(
    "remind_days",
    "Reminder lead time",
    "number",
    "notifications-outline",
  );
export const planFields: Record<PlanKind, FieldSpec[]> = {
  salary: [
    title,
    amount,
    f("payday", "Payday", "number", "calendar-outline"),
    account,
    category,
    f("start_date", "Start date", "date", "calendar-outline"),
    f("auto_post", "Automatic posting", "toggle", "sync-outline"),
    lead,
    active,
  ],
  recurring: [
    title,
    f("type", "Entry type", "choice", "swap-horizontal-outline", [
      "EXPENSE",
      "INCOME",
      "TRANSFER",
    ]),
    amount,
    account,
    f(
      "destination_account_id",
      "Destination",
      "account",
      "arrow-forward-outline",
    ),
    category,
    f("anchor_date", "First date", "date", "calendar-outline"),
    f("interval_unit", "Repeat unit", "choice", "repeat-outline", [
      "DAY",
      "WEEK",
      "MONTH",
      "YEAR",
    ]),
    f("interval_count", "Repeat every", "number", "repeat-outline"),
    f("auto_post", "Automatic posting", "toggle", "sync-outline"),
    active,
  ],
  loans: [
    title,
    f("principal_minor", "Principal", "money", "wallet-outline"),
    f("annual_rate_bps", "Annual interest", "percent", "trending-up-outline"),
    f("tenure_months", "Loan term", "tenure", "calendar-outline"),
    f("emi_minor", "Monthly EMI", "money", "cash-outline"),
    f("first_due_date", "First payment", "date", "calendar-outline"),
    account,
    category,
    lead,
    active,
  ],
  subscriptions: [
    title,
    amount,
    f("anchor_date", "Next tracked renewal", "date", "calendar-outline"),
    f("interval_unit", "Billing unit", "choice", "repeat-outline", [
      "DAY",
      "WEEK",
      "MONTH",
      "YEAR",
    ]),
    f("interval_count", "Repeat every", "number", "repeat-outline"),
    account,
    category,
    lead,
    active,
  ],
  budgets: [
    { ...category, optional: false },
    f("limit_minor", "Monthly limit", "money", "pie-chart-outline"),
    f("month", "Month", "month", "calendar-outline"),
    f("alert_percent", "Alert threshold", "number", "notifications-outline"),
  ],
  goals: [
    title,
    f("target_minor", "Target", "money", "flag-outline"),
    f("deadline", "Deadline", "date", "calendar-outline", undefined, true),
    f("color_hex", "Color", "color", "color-palette-outline"),
    active,
  ],
  profiles: [
    title,
    f("target_minutes", "Work target", "duration", "time-outline"),
    f(
      "buffer_minutes",
      "Safety buffer",
      "duration",
      "shield-checkmark-outline",
    ),
    f("tracking_mode", "Tracking mode", "choice", "pulse-outline", [
      "GROSS",
      "NET",
    ]),
    f("shift_type", "Shift type", "choice", "business-outline", [
      "OFFICE",
      "WFH",
      "HALF_DAY",
      "CUSTOM",
      "OPEN_ENDED",
    ]),
    f("cutoff_minute", "Day reset", "time", "moon-outline"),
    f("weekdays", "Workdays", "weekdays", "calendar-outline"),
  ],
};
export const accountFields = [
  f("name", "Name", "text", "text-outline"),
  f("account_type", "Type", "choice", "wallet-outline", [
    "BANK",
    "CASH",
    "WALLET",
  ]),
  f("color_hex", "Color", "color", "color-palette-outline"),
  f("balance_minor", "Balance", "signedMoney", "cash-outline"),
];
export const categoryFields = [
  f("name", "Name", "text", "text-outline"),
  f("kind", "Type", "choice", "swap-horizontal-outline", [
    "EXPENSE",
    "INCOME",
    "BOTH",
  ]),
  f("icon_name", "Icon", "icon", "shapes-outline"),
  f("color_hex", "Color", "color", "color-palette-outline"),
];
export const transactionFields = [
  amount,
  f("type", "Type", "choice", "swap-horizontal-outline", [
    "EXPENSE",
    "INCOME",
    "TRANSFER",
  ]),
  account,
  f(
    "destination_account_id",
    "Destination",
    "account",
    "arrow-forward-outline",
  ),
  category,
  f("transaction_date", "Date & time", "datetime", "calendar-outline"),
  f("note", "Note", "text", "document-text-outline", undefined, true),
  f("tags", "Tags", "text", "pricetags-outline", undefined, true),
  f("is_reimbursable", "Reimbursable", "toggle", "business-outline"),
];
export const dueFields = [
  title,
  f("due_at", "Date & time", "datetime", "calendar-outline"),
];
export const reminderFields = [
  title,
  f("message", "Message", "text", "chatbubble-outline", undefined, true),
  f("minute", "Time", "time", "time-outline"),
  f("days", "Repeat days", "weekdays", "calendar-outline"),
  f("enabled", "Enabled", "toggle", "power-outline"),
];
export const workFields = [
  f("first_swipe_in", "Swipe in", "datetime", "enter-outline"),
  f("last_swipe_out", "Swipe out", "datetime", "exit-outline"),
  f("target_minutes", "Target", "duration", "time-outline"),
  f("shift_type", "Shift type", "choice", "business-outline", [
    "OFFICE",
    "WFH",
    "CUSTOM",
  ]),
  f("notes", "Note", "text", "document-text-outline", undefined, true),
];
export const breakFields = [
  f("break_start", "Break starts", "datetime", "pause-outline"),
  f("break_end", "Break ends", "datetime", "play-outline", undefined, true),
];
export const billFields = [
  title,
  amount,
  f("due_day_of_month", "Due day", "number", "calendar-outline"),
  account,
  f("commitment_type", "Type", "choice", "receipt-outline", [
    "EMI",
    "SUBSCRIPTION",
    "RENT",
    "OTHER",
  ]),
];
export const preferenceFields = [
  f("currency", "Currency", "text", "cash-outline"),
  f("cycleDay", "Cycle starts on", "number", "calendar-outline"),
  f("theme", "Theme", "choice", "moon-outline", ["system", "light", "dark"]),
  f("accent", "Accent", "color", "color-palette-outline"),
  f("baseline", "Daily target", "duration", "time-outline"),
  f("buffer", "Safety buffer", "duration", "shield-checkmark-outline"),
  f("startOfDay", "Preferred start", "time", "sunny-outline"),
  f("cutoff", "Day reset", "time", "moon-outline"),
  f("mode", "Tracking mode", "choice", "pulse-outline", ["GROSS", "NET"]),
  f("defaultShiftType", "Default shift", "choice", "business-outline", [
    "OFFICE",
    "WFH",
    "HALF_DAY",
    "CUSTOM",
    "OPEN_ENDED",
  ]),
  f(
    "shiftWarningMinutes",
    "Advance warning",
    "duration",
    "notifications-outline",
  ),
  f("overtimeMinutes", "Overtime reminder", "duration", "alarm-outline"),
  f("weekends", "Days off", "weekdays", "calendar-outline"),
  f("officeDays", "Office days per week", "number", "business-outline"),
  f(
    "useWeeklyTargets",
    "Different weekday targets",
    "toggle",
    "calendar-outline",
  ),
  f("notifications", "All alerts", "toggle", "notifications-outline"),
  f("workNotifications", "Work alerts", "toggle", "time-outline"),
  f("financeNotifications", "Finance alerts", "toggle", "wallet-outline"),
  f("financeReminderMinute", "Finance alert time", "time", "alarm-outline"),
];
export const planNames: Record<PlanKind, string> = {
  salary: "Salary",
  recurring: "Recurring entry",
  loans: "Loan",
  subscriptions: "Subscription",
  budgets: "Budget",
  goals: "Goal",
  profiles: "Work profile",
};
export const wizardKeys: Record<string, string[]> = {
  salary: ["title", "amount_minor", "payday", "account_id"],
  recurring: [
    "title",
    "type",
    "amount_minor",
    "account_id",
    "anchor_date",
    "interval_unit",
    "interval_count",
  ],
  loans: [
    "title",
    "principal_minor",
    "annual_rate_bps",
    "tenure_months",
    "emi_minor",
    "first_due_date",
    "account_id",
  ],
  subscriptions: [
    "title",
    "amount_minor",
    "interval_unit",
    "interval_count",
    "anchor_date",
    "account_id",
  ],
  budgets: ["category_id", "limit_minor", "month"],
  goals: ["title", "target_minor", "deadline"],
  profiles: ["title", "target_minutes", "tracking_mode", "cutoff_minute"],
  bill: ["title", "amount_minor", "due_day_of_month", "account_id"],
  account: ["name", "account_type", "balance_minor"],
  category: ["name", "kind", "icon_name", "color_hex"],
  worklog: ["first_swipe_in", "last_swipe_out", "shift_type", "target_minutes"],
  reminder: ["title", "minute", "days"],
  due: ["title", "due_at"],
};
export function fieldsFor(entity: Entity, kind?: PlanKind): FieldSpec[] {
  return entity === "due"
    ? dueFields
    : entity === "entry"
      ? transactionFields.filter((f) =>
          ["note", "tags", "transaction_date", "is_reimbursable"].includes(
            f.key,
          ),
        )
      : entity === "bill"
        ? billFields
        : entity === "worklog"
          ? workFields
          : entity === "break"
            ? breakFields
            : entity === "plan" && kind
              ? (planFields[kind] ?? [])
              : entity === "account"
                ? accountFields
                : entity === "category"
                  ? categoryFields
                  : entity === "transaction"
                    ? transactionFields
                    : entity === "reminder"
                      ? reminderFields
                      : preferenceFields;
}
export function fieldFor(entity: Entity, key: string, kind?: PlanKind) {
  if (entity === "settings" && /^week-[0-6]$/.test(key))
    return f(
      key,
      [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ][Number(key.slice(-1))]!,
      "duration",
      "time-outline",
    );
  return fieldsFor(entity, kind).find((f) => f.key === key);
}
export function recordFor(
  entity: Entity,
  id?: string,
  kind?: PlanKind,
): Data | undefined {
  const s = useStore.getState();
  if (entity === "due")
    return s.dueReminders.find(
      (r) => r.id === id && r.kind === "CUSTOM",
    ) as unknown as Data | undefined;
  if (entity === "entry") return { ...useEntryOptions.getState() };
  if (entity === "bill") {
    const c = s.commitments.find((c) => c.id === id);
    return c ? { ...c, amount_minor: Math.round(c.amount * 100) } : undefined;
  }
  if (entity === "worklog")
    return s.shifts.find((x) => x.id === id) as unknown as Data | undefined;
  if (entity === "break")
    return s.breaks.find((x) => x.id === id) as unknown as Data | undefined;
  if (entity === "settings")
    return {
      ...s.settings,
      ...Object.fromEntries(
        s.settings.weekTargets.map((v, i) => ["week-" + i, v]),
      ),
    };
  if (entity === "plan" && kind && Object.hasOwn(planFields, kind))
    return (s[kind] as unknown as Data[]).find((r) => r.id === id);
  if (entity === "account") {
    const a = [...s.accounts, ...s.archivedAccounts].find((a) => a.id === id);
    return a ? { ...a, balance_minor: a.current_balance_minor } : undefined;
  }
  if (entity === "category")
    return s.categories.find((c) => c.id === id) as unknown as Data | undefined;
  if (entity === "transaction") {
    const t = s.transactions.find((t) => t.id === id);
    return t
      ? { ...t, tags: (JSON.parse(t.tags) as string[]).join(", ") }
      : undefined;
  }
  return s.settings.reminders.find((r) => r.id === id) as unknown as
    | Data
    | undefined;
}
export function defaultsFor(entity: Entity, kind?: PlanKind): Data {
  const s = useStore.getState(),
    a = s.accounts[0]?.id ?? "",
    incoming =
      s.categories.find(
        (c) => c.is_active && (c.kind === "INCOME" || c.kind === "BOTH"),
      )?.id ?? null;
  return {
    due_at: new Date(Date.now() + 3600000).toISOString(),
    first_swipe_in: new Date(Date.now() - 3600000).toISOString(),
    last_swipe_out: new Date().toISOString(),
    notes: "",
    commitment_type: "OTHER",
    due_day_of_month: new Date().getDate(),
    title: "",
    name: "",
    account_id: a,
    destination_account_id: s.accounts[1]?.id ?? null,
    account_type: "BANK",
    category_id: kind === "salary" ? incoming : null,
    amount_minor: 0,
    balance_minor: 0,
    principal_minor: 0,
    annual_rate_bps: 0,
    tenure_months: 12,
    emi_minor: 0,
    payday: new Date().getDate(),
    start_date: dateKey(),
    anchor_date: dateKey(),
    first_due_date: dateKey(),
    interval_count: 1,
    interval_unit: "MONTH",
    auto_post: 0,
    is_active: 1,
    remind_days: 3,
    type: "EXPENSE",
    kind: "EXPENSE",
    icon_name: "wallet-outline",
    color_hex: s.settings.accent,
    month: dateKey().slice(0, 7),
    limit_minor: 0,
    alert_percent: 80,
    target_minor: 0,
    deadline: null,
    target_minutes: s.settings.baseline,
    buffer_minutes: s.settings.buffer,
    tracking_mode: s.settings.mode,
    shift_type: "OFFICE",
    cutoff_minute: s.settings.cutoff,
    weekdays: 127 ^ s.settings.weekends,
    minute: s.settings.startOfDay,
    days: 127 ^ s.settings.weekends || 127,
    enabled: true,
    message: "",
  };
}
export function formatField(spec: FieldSpec, value: unknown) {
  const s = useStore.getState();
  if (value === null || value === undefined || value === "") return "Not set";
  if (spec.type === "tenure")
    return `${Math.floor(Number(value) / 12)}y ${Number(value) % 12}mo`;
  if (spec.type === "duration")
    return `${Math.floor(Number(value) / 60)}h ${Number(value) % 60}m`;
  if (spec.type === "time") return durationText(Number(value));
  if (spec.type === "money" || spec.type === "signedMoney")
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: s.settings.currency,
    }).format(Number(value) / 100);
  if (spec.type === "percent") return `${Number(value) / 100}%`;
  if (spec.type === "account")
    return (
      [...s.accounts, ...s.archivedAccounts].find((a) => a.id === value)
        ?.name ?? "Choose account"
    );
  if (spec.type === "category")
    return s.categories.find((c) => c.id === value)?.name ?? "Uncategorized";
  if (spec.type === "toggle") return value ? "On" : "Off";
  if (spec.type === "weekdays")
    return (
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        .filter((_, i) => Number(value) & (1 << i))
        .join(" · ") || "None"
    );
  if (spec.type === "datetime")
    return new Date(String(value)).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (spec.type === "date")
    return new Date(
      String(value) + (spec.type === "date" ? "T12:00:00" : ""),
    ).toLocaleDateString();
  return String(value).replaceAll("_", " ").replace("-outline", "");
}
export function validateValue(
  entity: Entity,
  spec: FieldSpec,
  value: unknown,
  kind?: PlanKind,
) {
  if (spec.optional && (value === null || value === "")) return;
  if (spec.type === "duration" && !Number.isFinite(Number(value)))
    throw Error("Use hours 0–24 and minutes 0–59");
  if (spec.type === "tenure" && !Number.isFinite(Number(value)))
    throw Error("Use years and months 0–11");
  if (spec.type === "money") z.number().int().positive().max(9e12).parse(value);
  if (["number", "duration", "percent", "tenure"].includes(spec.type))
    z.number().int().nonnegative().parse(value);
  if (["text", "account", "category"].includes(spec.type) && !spec.optional)
    z.string().trim().min(1).parse(value);
  if (spec.type === "color")
    z.string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .parse(value);
  if (entity === "plan" && kind) {
    const schema = (planSchemas[kind].shape as Record<string, z.ZodType>)[
      spec.key
    ];
    if (schema) schema.parse(value);
  }
  if (entity === "settings" && !spec.key.startsWith("week-")) {
    const schema = (settingsSchema.shape as Record<string, z.ZodType>)[
      spec.key
    ];
    if (schema) schema.parse(value);
  }
  if (entity === "settings" && spec.key.startsWith("week-"))
    z.number().int().min(0).max(1440).parse(value);
}
export async function saveRecord(
  entity: Entity,
  data: Data,
  id?: string,
  kind?: PlanKind,
) {
  if (entity === "due") {
    const at = new Date(String(data.due_at));
    if (
      !String(data.title).trim() ||
      !Number.isFinite(at.getTime()) ||
      at.getTime() <= Date.now()
    )
      throw Error("Choose a name and future date/time");
    const key = id ?? uid();
    await db().runAsync(
      "INSERT INTO reminders(id,kind,source_id,occurrence_date,title,due_at,notification_at) VALUES(?,'CUSTOM',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET occurrence_date=excluded.occurrence_date,title=excluded.title,due_at=excluded.due_at,notification_at=excluded.notification_at,status='PENDING',enabled=1",
      key,
      key,
      dateKey(at),
      String(data.title).trim(),
      at.toISOString(),
      at.toISOString(),
    );
    return key;
  }
  if (entity === "entry") return { ...useEntryOptions.getState() };
  if (entity === "bill") {
    const c = {
      title: String(data.title),
      amount: Number(data.amount_minor) / 100,
      due_day_of_month: Number(data.due_day_of_month),
      account_id: String(data.account_id),
      commitment_type: data.commitment_type as "OTHER",
    };
    if (id) return CommitmentRepository.update(id, c);
    return CommitmentRepository.add(c);
  }
  if (entity === "worklog") {
    const settings = useStore.getState().settings;
    return ShiftRepository.addManual(
      Date.parse(String(data.first_swipe_in)),
      Date.parse(String(data.last_swipe_out)),
      Number(data.target_minutes),
      data.shift_type as "OFFICE" | "WFH" | "CUSTOM",
      String(data.notes ?? ""),
      settings,
    );
  }
  if (entity === "plan" && kind) return PlanningRepository.save(kind, data, id);
  if (entity === "account") {
    const minor = Number(data.balance_minor);
    if (!Number.isSafeInteger(minor) || Math.abs(minor) > 9e12)
      throw Error("Enter a valid balance");
    const key = await AccountRepository.save(
      id ?? null,
      String(data.name),
      data.account_type as "BANK",
      String(data.color_hex),
    );
    if (!id || recordFor("account", id)?.balance_minor !== minor)
      await AccountRepository.rebalance(key, String(data.name), minor / 100);
    return key;
  }
  if (entity === "category") return CategoryRepository.save(data, id);
  if (entity === "reminder") {
    const s = useStore.getState();
    const key = id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const reminder = {
      id: key,
      title: String(data.title),
      message: String(data.message ?? ""),
      minute: Number(data.minute),
      days: Number(data.days),
      enabled: !!data.enabled,
    };
    await SettingsRepository.save(
      "reminders",
      id
        ? s.settings.reminders.map((r) => (r.id === id ? reminder : r))
        : [...s.settings.reminders, reminder],
    );
    return key;
  }
  throw Error("Unsupported setup");
}
export async function saveField(
  entity: Entity,
  id: string | undefined,
  spec: FieldSpec,
  value: unknown,
  kind?: PlanKind,
  extra?: Data,
) {
  value =
    spec.optional && value === ""
      ? null
      : entity === "settings" && spec.key === "currency"
        ? String(value).trim().toUpperCase()
        : value;
  validateValue(entity, spec, value, kind);
  if (entity === "entry") {
    if (
      spec.type === "datetime" &&
      (!Number.isFinite(Date.parse(String(value))) ||
        Date.parse(String(value)) > Date.now())
    )
      throw Error("Choose a past date and time");
    useEntryOptions.getState().setField(spec.key, value);
    return;
  }
  const old = recordFor(entity, id, kind);
  if (!old) throw Error("Record unavailable");
  const data = { ...old, ...extra, [spec.key]: value };
  if (entity === "worklog") {
    const shift = useStore.getState().shifts.find((x) => x.id === id);
    if (!shift) throw Error("Shift unavailable");
    if (spec.key === "target_minutes")
      return ShiftRepository.changeTarget(shift, Number(value));
    return ShiftRepository.edit(
      shift,
      Date.parse(String(data.first_swipe_in)),
      data.last_swipe_out ? Date.parse(String(data.last_swipe_out)) : null,
      String(data.notes ?? ""),
    );
  }
  if (entity === "break")
    return ShiftRepository.editBreak(
      id!,
      Date.parse(String(data.break_start)),
      data.break_end ? Date.parse(String(data.break_end)) : null,
    );
  if (entity === "settings") {
    if (spec.key.startsWith("week-")) {
      const week = [...useStore.getState().settings.weekTargets];
      week[Number(spec.key.slice(-1))] = Number(value);
      return SettingsRepository.save("weekTargets", week);
    }
    return SettingsRepository.save(spec.key as keyof Settings, value as never);
  }
  if (entity === "transaction") {
    if (spec.key === "type") {
      data.category_id = null;
      if (value !== "EXPENSE") data.is_reimbursable = 0;
    }
    const e: Entry = {
      accountId: String(data.account_id),
      destinationId:
        data.type === "TRANSFER"
          ? String(data.destination_account_id ?? "")
          : undefined,
      type: data.type as Entry["type"],
      amount: Number(data.amount_minor) / 100,
      categoryId:
        data.type === "TRANSFER"
          ? undefined
          : ((data.category_id as string | null) ?? undefined),
      date: String(data.transaction_date),
      note: String(data.note ?? ""),
      tags: String(data.tags ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      reimbursable: data.type === "EXPENSE" && !!data.is_reimbursable,
    };
    return TransactionRepository.edit(id!, e);
  }
  return saveRecord(entity, data, id, kind);
}
