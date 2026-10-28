import { useRouter, Href } from "expo-router";
export type RootStack = {
  ReminderEdit: { id?: string } | undefined;
  ManualShift: undefined;
  BreakEdit: { id: string };
  Main: undefined;
  Dashboard: undefined;
  ShiftDetails: { shiftId: string };
  SafeArrival: undefined;
  BreakHistory: { shiftId: string };
  DayDetails: { date: string };
  AddHoliday: { date?: string } | undefined;
  Holidays: undefined;
  Compliance: undefined;
  QuickEntry: undefined;
  Transfer: undefined;
  Reimbursements: undefined;
  Commitments: undefined;
  Split: undefined;
  Rebalance: undefined;
  Backup: undefined;
  Security: undefined;
  Calendar: undefined;
  FinanceCalendar: undefined;
  Categories: undefined;
  CategoryEdit: { id?: string } | undefined;
  Accounts: undefined;
  AccountEdit: { id?: string } | undefined;
  Salary: undefined;
  Loans: undefined;
  LoanDetails: { id: string };
  Subscriptions: undefined;
  SubscriptionDetails: { id: string };
  Recurring: undefined;
  Budgets: undefined;
  Goals: undefined;
  GoalDetails: { id: string };
  Contribution: { id: string };
  PlanEdit: { kind: string; id?: string };
  TransactionDetails: { id: string };
  Reminders: undefined;
  DueDetails: { id: string };
  WorkSettings: undefined;
  WorkProfiles: undefined;
  Settings: undefined;
  Analytics: undefined;
  Planning: undefined;
};
export const paths: Record<keyof RootStack, string> = {
  ReminderEdit: "/reminder-edit",
  ManualShift: "/manual-shift",
  BreakEdit: "/break-edit",
  Main: "/",
  Dashboard: "/",
  ShiftDetails: "/shift-details",
  SafeArrival: "/safe-arrival",
  BreakHistory: "/break-history",
  DayDetails: "/day-details",
  AddHoliday: "/add-holiday",
  Holidays: "/holidays",
  Compliance: "/compliance",
  QuickEntry: "/quick-entry",
  Transfer: "/transfer",
  Reimbursements: "/reimbursements",
  Commitments: "/commitments",
  Split: "/split",
  Rebalance: "/accounts",
  Backup: "/backup",
  Security: "/security",
  Calendar: "/work-calendar",
  FinanceCalendar: "/finance-calendar",
  Categories: "/categories",
  CategoryEdit: "/category-edit",
  Accounts: "/accounts",
  AccountEdit: "/account-edit",
  Salary: "/salary",
  Loans: "/loans",
  LoanDetails: "/loan-details",
  Subscriptions: "/subscriptions",
  SubscriptionDetails: "/subscription-details",
  Recurring: "/recurring",
  Budgets: "/budgets",
  Goals: "/goals",
  GoalDetails: "/goal-details",
  Contribution: "/contribution",
  PlanEdit: "/plan-edit",
  TransactionDetails: "/transaction-details",
  Reminders: "/reminders",
  DueDetails: "/due-details",
  WorkSettings: "/work-settings",
  WorkProfiles: "/work-profiles",
  Settings: "/settings",
  Analytics: "/analytics",
  Planning: "/planning",
};
export function useNav() {
  const router = useRouter();
  return {
    navigate: <K extends keyof RootStack>(
      name: K,
      ...params: undefined extends RootStack[K]
        ? [RootStack[K]?]
        : [RootStack[K]]
    ) =>
      router.push({ pathname: paths[name], params: params[0] ?? {} } as Href),
    goBack: () => (router.canGoBack() ? router.back() : router.replace("/")),
  };
}
