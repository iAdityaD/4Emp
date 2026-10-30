export type TrackingMode = "GROSS" | "NET";
export type ShiftType = "OFFICE" | "WFH" | "HALF_DAY" | "CUSTOM" | "OPEN_ENDED";
export type ShiftStatus = "ACTIVE" | "COMPLETED" | "NEEDS_REVIEW";
export interface Shift {
  id: string;
  work_date: string;
  tracking_mode: TrackingMode;
  shift_type: ShiftType;
  target_minutes: number;
  buffer_minutes: number;
  first_swipe_in: string;
  last_swipe_out: string | null;
  status: ShiftStatus;
  notes: string | null;
  created_at: number;
  cutoff_at: string | null;
}
export interface Break {
  id: string;
  shift_id: string;
  break_start: string;
  break_end: string | null;
  duration_minutes: number;
}
export interface Account {
  id: string;
  name: string;
  account_type: "BANK_1" | "BANK_2" | "BANK" | "CASH" | "WALLET";
  opening_minor: number;
  current_balance_minor: number;
  starting_balance: number;
  current_balance: number;
  color_hex: string;
  is_active: number;
}
export interface Category {
  kind: "EXPENSE" | "INCOME" | "BOTH";
  is_active: number;
  id: string;
  name: string;
  icon_name: string;
  color_hex: string;
  is_system: number;
}
export interface Transaction {
  id: string;
  account_id: string;
  destination_account_id: string | null;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount_minor: number;
  amount: number;
  category_id: string | null;
  transaction_date: string;
  note: string | null;
  is_reimbursable: number;
  reimbursement_status: "NOT_APPLICABLE" | "PENDING" | "SETTLED";
  is_split: number;
  split_group_id: string | null;
  split_total_amount: number | null;
  split_my_share: number | null;
  split_notes: string | null;
  created_at: number;
  ledger_kind: "PERSONAL" | "REIMBURSEMENT" | "ADJUSTMENT" | "COMMITMENT";
  linked_transaction_id: string | null;
  tags: string;
}
export interface Commitment {
  id: string;
  title: string;
  amount: number;
  due_day_of_month: number;
  account_id: string;
  commitment_type: "EMI" | "SUBSCRIPTION" | "RENT" | "OTHER";
  is_active: number;
}
export interface Holiday {
  id: string;
  holiday_date: string;
  title: string;
  is_optional: number;
}
export interface CalendarMark {
  work_date: string;
  kind: "LEAVE" | "NON_WORKING" | "WORKED";
  note: string;
}
export interface Reminder {
  day_scope?: "WORKDAYS" | "DAYS_OFF";
  id: string;
  title: string;
  message: string;
  minute: number;
  days: number;
  enabled: boolean;
}
export interface Settings {
  focusNotifications: boolean;
  focusTarget: number;
  shiftWarningMinutes: number;
  overtimeMinutes: number;
  baseline: number;
  buffer: number;
  cutoff: number;
  mode: TrackingMode;
  weekends: number;
  officeDays: number;
  notifications: boolean;
  financeNotifications: boolean;
  workNotifications: boolean;
  lock: boolean;
  onboarded: boolean;
  theme: "system" | "dark" | "light";
  currency: string;
  cycleDay: number;
  reminders: Reminder[];
  accent: string;
  financeReminderMinute: number;
  hideBalances: boolean;
  weekTargets: number[];
  startOfDay: number;
  useWeeklyTargets: boolean;
  defaultShiftType: ShiftType;
}
export const defaultSettings: Settings = {
  focusNotifications: true,
  focusTarget: 25,
  accent: "#00A88A",
  financeReminderMinute: 540,
  hideBalances: false,
  weekTargets: [510, 510, 510, 510, 510, 0, 0],
  startOfDay: 540,
  useWeeklyTargets: false,
  defaultShiftType: "OFFICE",
  shiftWarningMinutes: 15,
  overtimeMinutes: 60,
  baseline: 510,
  buffer: 5,
  cutoff: 1439,
  mode: "GROSS",
  weekends: 96,
  officeDays: 5,
  notifications: true,
  financeNotifications: true,
  workNotifications: true,
  lock: false,
  onboarded: false,
  theme: "system",
  currency: "INR",
  cycleDay: 1,
  reminders: [
    {
      id: "lunch",
      title: "Lunch",
      message: "Time for a lunch break.",
      minute: 780,
      days: 31,
      enabled: true,
    },
    {
      id: "tea",
      title: "Tea",
      message: "Take a short tea break.",
      minute: 960,
      days: 31,
      enabled: true,
    },
    {
      id: "timesheet",
      title: "Timesheet",
      message: "Remember to fill your timesheet.",
      minute: 1050,
      days: 31,
      enabled: true,
    },
  ],
};
