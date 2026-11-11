import type { Settings } from "../../domain/models";
import type { IconName } from "../design/primitives";
/**
 * Every user-adjustable rule is declared once here. The Rules screen, the
 * focused editor and the settings list are all generated from this registry,
 * so adding a rule means: add the setting (models + settingsValidation), then
 * add one entry below. No screen needs to change.
 */
export type RuleGroup = "money" | "insights" | "focus" | "modules";
type RuleKey = {
  [K in keyof Settings]: Settings[K] extends boolean | number ? K : never;
}[keyof Settings];
export interface RuleSpec {
  key: RuleKey;
  group: RuleGroup;
  label: string;
  /** Plain-language effect of the rule, shown under its name. */
  description: string;
  type: "toggle" | "number";
  icon: IconName;
  /** Singular unit for number rules, e.g. "hour". */
  unit?: string;
  /** Text shown for a number rule set to 0, when 0 means "no limit". */
  zero?: string;
}
export const ruleGroups: { id: RuleGroup; title: string }[] = [
  { id: "money", title: "Money rules" },
  { id: "insights", title: "Insight rules" },
  { id: "focus", title: "Focus rules" },
  { id: "modules", title: "Sections shown in Plan" },
];
export const rules: RuleSpec[] = [
  {
    key: "editLock",
    group: "money",
    label: "Lock old entries",
    description: "Stop edits and deletion once the edit window has passed.",
    type: "toggle",
    icon: "lock-closed-outline",
  },
  {
    key: "editWindowHours",
    group: "money",
    label: "Edit window",
    description: "How long after its recorded time an entry can be changed.",
    type: "number",
    icon: "hourglass-outline",
    unit: "hour",
  },
  {
    key: "autoPostCatchUpDays",
    group: "money",
    label: "Auto-post catch-up",
    description:
      "How far back automatic posting may fill in missed dates. Older dates stay as due items for you to record.",
    type: "number",
    icon: "sync-outline",
    unit: "day",
    zero: "No limit",
  },
  {
    key: "quickEntryCount",
    group: "money",
    label: "Quick entries",
    description:
      "How many of your most repeated entries to offer as one-tap shortcuts.",
    type: "number",
    icon: "flash-outline",
    unit: "shortcut",
    zero: "Off",
  },
  {
    key: "insightChangePercent",
    group: "insights",
    label: "Spending change alert",
    description:
      "Point out a category when its spend moves at least this much against last month.",
    type: "number",
    icon: "trending-up-outline",
    unit: "%",
  },
  {
    key: "renewalWindowDays",
    group: "insights",
    label: "Renewal look-ahead",
    description: "How far ahead Insights lists subscription renewals.",
    type: "number",
    icon: "calendar-outline",
    unit: "day",
  },
  {
    key: "showWorkCost",
    group: "insights",
    label: "Show cost in work time",
    description:
      "Translate spending into hours of work, using your salary and work schedule.",
    type: "toggle",
    icon: "time-outline",
  },
  {
    key: "focusLabelRequired",
    group: "focus",
    label: "Require a focus label",
    description: "Ask what you are working on before a focus timer starts.",
    type: "toggle",
    icon: "pricetag-outline",
  },
  {
    key: "moduleBudgets",
    group: "modules",
    label: "Budgets",
    description: "Monthly category limits and alerts.",
    type: "toggle",
    icon: "pie-chart-outline",
  },
  {
    key: "moduleGoals",
    group: "modules",
    label: "Savings goals",
    description: "Targets, reservations and contributions.",
    type: "toggle",
    icon: "flag-outline",
  },
  {
    key: "moduleLoans",
    group: "modules",
    label: "Loans & EMIs",
    description: "Amortization schedules and EMI payments.",
    type: "toggle",
    icon: "card-outline",
  },
  {
    key: "moduleLending",
    group: "modules",
    label: "Lending",
    description: "Money lent to people and their repayments.",
    type: "toggle",
    icon: "people-outline",
  },
  {
    key: "moduleReimbursements",
    group: "modules",
    label: "Employer claims",
    description: "Reimbursable expenses and their settlement.",
    type: "toggle",
    icon: "business-outline",
  },
  {
    key: "moduleBills",
    group: "modules",
    label: "Monthly bills",
    description: "Fixed bills paid once per cycle.",
    type: "toggle",
    icon: "receipt-outline",
  },
];
export function ruleText(rule: RuleSpec, value: boolean | number) {
  if (rule.type === "toggle") return value ? "On" : "Off";
  if (value === 0 && rule.zero) return rule.zero;
  if (rule.unit === "%") return `${value}%`;
  return `${value} ${rule.unit ?? ""}${rule.unit && value !== 1 ? "s" : ""}`.trim();
}
