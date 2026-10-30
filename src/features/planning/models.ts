export type IntervalUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";
export interface SalaryRule {
  id: string;
  title: string;
  amount_minor: number;
  payday: number;
  account_id: string;
  category_id: string | null;
  start_date: string;
  auto_post: number;
  is_active: number;
  remind_days: number;
}
export interface RecurringRule {
  id: string;
  title: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount_minor: number;
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  anchor_date: string;
  interval_count: number;
  interval_unit: IntervalUnit;
  auto_post: number;
  is_active: number;
}
export interface Loan {
  id: string;
  title: string;
  principal_minor: number;
  annual_rate_bps: number;
  tenure_months: number;
  emi_minor: number;
  first_due_date: string;
  account_id: string;
  category_id: string | null;
  remind_days: number;
  is_active: number;
}
export interface EMIPayment {
  id: string;
  loan_id: string;
  due_date: string;
  amount_minor: number;
  principal_minor: number;
  interest_minor: number;
  status: "PENDING" | "PAID";
  transaction_id: string | null;
}
export interface Subscription {
  end_date?: string | null;
  auto_post?: number;
  payment_type?: "EXPENSE" | "TRANSFER";
  destination_account_id?: string | null;
  id: string;
  title: string;
  amount_minor: number;
  anchor_date: string;
  interval_count: number;
  interval_unit: IntervalUnit;
  account_id: string;
  category_id: string | null;
  remind_days: number;
  is_active: number;
}
export interface Budget {
  reset_at?: string | null;
  id: string;
  category_id: string;
  month: string;
  limit_minor: number;
  alert_percent: number;
}
export interface Goal {
  tracking_basis?: "CONTRIBUTIONS" | "BALANCE" | "MONTHLY_SAVINGS";
  account_id?: string | null;
  id: string;
  title: string;
  target_minor: number;
  deadline: string | null;
  color_hex: string;
  is_active: number;
}
export interface Contribution {
  id: string;
  goal_id: string;
  account_id: string;
  amount_minor: number;
  contribution_date: string;
  note: string | null;
  transaction_id: string | null;
}
export interface DueReminder {
  id: string;
  kind: string;
  source_id: string;
  occurrence_date: string;
  title: string;
  amount_minor: number;
  due_at: string;
  notification_at: string;
  enabled: number;
  status: "PENDING" | "SCHEDULED" | "DISMISSED";
}
export interface WorkProfile {
  is_active: number;
  id: string;
  title: string;
  target_minutes: number;
  buffer_minutes: number;
  tracking_mode: "GROSS" | "NET";
  shift_type: "OFFICE" | "WFH" | "HALF_DAY" | "CUSTOM" | "OPEN_ENDED";
  cutoff_minute: number;
  weekdays: number;
}
export interface Lending {
  id: string;
  title: string;
  amount_minor: number;
  account_id: string;
  lent_date: string;
  due_date: string | null;
  notes: string;
  transaction_id: string;
}
export interface LendingRepayment {
  id: string;
  lending_id: string;
  amount_minor: number;
  account_id: string;
  payment_date: string;
  transaction_id: string;
}
export interface PlanningData {
  lending: Lending[];
  lendingRepayments: LendingRepayment[];
  salary: SalaryRule[];
  recurring: RecurringRule[];
  loans: Loan[];
  emis: EMIPayment[];
  subscriptions: Subscription[];
  subscriptionPayments: {
    subscription_id: string;
    occurrence_date: string;
    transaction_id: string;
  }[];
  budgets: Budget[];
  goals: Goal[];
  contributions: Contribution[];
  dueReminders: DueReminder[];
  profiles: WorkProfile[];
}
export const emptyPlanning: PlanningData = {
  lending: [],
  lendingRepayments: [],
  salary: [],
  recurring: [],
  loans: [],
  emis: [],
  subscriptions: [],
  subscriptionPayments: [],
  budgets: [],
  goals: [],
  contributions: [],
  dueReminders: [],
  profiles: [],
};
