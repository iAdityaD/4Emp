import { z } from "zod";
import { db, uid } from "../db/connection";
import { writeEntry } from "./TransactionRepository";
import { Account, Category } from "../domain/models";
import { dateKey } from "../domain/shift";
import {
  PlanningData,
  Loan,
  EMIPayment,
  Subscription,
  Goal,
} from "../features/planning/models";
import {
  minor,
  validDate,
  amortization,
  occurrences,
} from "../features/planning/calculations";
const title = z.string().trim().min(1).max(80),
  account = z.string().min(1),
  category = z.string().nullable().optional(),
  count = z.number().int().min(1).max(120),
  unit = z.enum(["DAY", "WEEK", "MONTH", "YEAR"]),
  active = z.number().int().min(0).max(1).default(1),
  days = z.number().int().min(0).max(30);
const common = {
  title,
  account_id: account,
  category_id: category,
  is_active: active,
};
export const planSchemas = {
  salary: z.object({
    ...common,
    amount_minor: minor,
    payday: z.number().int().min(1).max(31),
    start_date: validDate,
    auto_post: active,
    remind_days: days,
  }),
  recurring: z.object({
    ...common,
    type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
    amount_minor: minor,
    destination_account_id: z.string().nullable().optional(),
    anchor_date: validDate,
    interval_count: count,
    interval_unit: unit,
    auto_post: active,
  }),
  loans: z.object({
    ...common,
    principal_minor: minor,
    annual_rate_bps: z.number().int().min(0).max(10000),
    tenure_months: z.number().int().min(1).max(600),
    emi_minor: minor,
    first_due_date: validDate,
    remind_days: days,
  }),
  subscriptions: z.object({
    ...common,
    amount_minor: minor,
    anchor_date: validDate,
    interval_count: count,
    interval_unit: unit,
    remind_days: days,
  }),
  budgets: z.object({
    category_id: account,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    limit_minor: minor,
    alert_percent: z.number().int().min(1).max(100),
  }),
  goals: z.object({
    title,
    target_minor: minor,
    deadline: validDate.nullable(),
    color_hex: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    is_active: active,
  }),
  profiles: z.object({
    title,
    target_minutes: z.number().int().min(1).max(1440),
    buffer_minutes: z.number().int().min(0).max(60),
    tracking_mode: z.enum(["GROSS", "NET"]),
    shift_type: z.enum(["OFFICE", "WFH", "HALF_DAY", "CUSTOM", "OPEN_ENDED"]),
    cutoff_minute: z.number().int().min(0).max(1439),
    weekdays: z.number().int().min(0).max(127),
  }),
};
export type PlanKind = keyof typeof planSchemas;
export const planTables: Record<PlanKind, string> = {
  salary: "salary_rules",
  recurring: "recurring_rules",
  loans: "loans",
  subscriptions: "subscriptions",
  budgets: "budgets",
  goals: "savings_goals",
  profiles: "work_profiles",
};
export const PlanningRepository = {
  async load(): Promise<PlanningData> {
    const names = [
      "salary_rules",
      "recurring_rules",
      "loans",
      "emi_payments",
      "subscriptions",
      "subscription_payments",
      "budgets",
      "savings_goals",
      "goal_contributions",
      "reminders",
      "work_profiles",
    ];
    const rows = await Promise.all(
      names.map((n) => db().getAllAsync(`SELECT * FROM ${n}`)),
    );
    return Object.fromEntries(
      [
        "salary",
        "recurring",
        "loans",
        "emis",
        "subscriptions",
        "subscriptionPayments",
        "budgets",
        "goals",
        "contributions",
        "dueReminders",
        "profiles",
      ].map((key, i) => [key, rows[i]]),
    ) as unknown as PlanningData;
  },
  async save(kind: PlanKind, input: unknown, id?: string) {
    const data = planSchemas[kind].parse(input) as Record<
      string,
      string | number | null
    >;
    const key = id ?? uid();
    const table = planTables[kind];
    await db().withExclusiveTransactionAsync(async (tx) => {
      if (
        "account_id" in data &&
        !(await tx.getFirstAsync(
          "SELECT id FROM accounts WHERE id=? AND is_active=1",
          data.account_id!,
        ))
      )
        throw Error("Choose an active account");
      if (data.category_id) {
        const c = await tx.getFirstAsync<Category>(
          "SELECT * FROM categories WHERE id=? AND is_active=1",
          data.category_id,
        );
        const expected =
          kind === "salary"
            ? "INCOME"
            : kind === "recurring"
              ? data.type
              : "EXPENSE";
        if (
          !c ||
          (expected !== "TRANSFER" && c.kind !== "BOTH" && c.kind !== expected)
        )
          throw Error(
            "Choose a category matching this plan’s income or expense type",
          );
      }
      if (
        data.destination_account_id &&
        !(await tx.getFirstAsync(
          "SELECT id FROM accounts WHERE id=? AND is_active=1",
          data.destination_account_id,
        ))
      )
        throw Error("Choose an active destination account");
      if (
        kind === "recurring" &&
        data.type === "TRANSFER" &&
        (!data.destination_account_id ||
          data.destination_account_id === data.account_id)
      )
        throw Error("Select different transfer accounts");
      let preserveLoanSchedule = false;
      if (
        kind === "loans" &&
        id &&
        (await tx.getFirstAsync(
          "SELECT id FROM emi_payments WHERE loan_id=? AND status='PAID'",
          id,
        ))
      ) {
        const old = await tx.getFirstAsync<Loan>(
          "SELECT * FROM loans WHERE id=?",
          id,
        );
        if (
          old &&
          (
            [
              "principal_minor",
              "annual_rate_bps",
              "tenure_months",
              "emi_minor",
              "first_due_date",
            ] as const
          ).some((key) => old[key] !== data[key])
        )
          throw Error(
            "Paid loan terms are protected. Archive and create a refinanced loan instead.",
          );
        preserveLoanSchedule = true;
      }
      if (
        kind === "salary" &&
        id &&
        (await tx.getFirstAsync(
          "SELECT rule_id FROM salary_occurrences WHERE rule_id=?",
          id,
        ))
      ) {
        const old = await tx.getFirstAsync<{
          payday: number;
          start_date: string;
        }>("SELECT payday,start_date FROM salary_rules WHERE id=?", id);
        if (
          old &&
          (old.payday !== data.payday || old.start_date !== data.start_date)
        )
          throw Error(
            "Archive this salary rule and add a new one to change its paid schedule",
          );
      }
      if (
        kind === "recurring" &&
        id &&
        (await tx.getFirstAsync(
          "SELECT rule_id FROM recurring_occurrences WHERE rule_id=?",
          id,
        ))
      ) {
        const old = await tx.getFirstAsync<{
          anchor_date: string;
          interval_count: number;
          interval_unit: string;
        }>("SELECT * FROM recurring_rules WHERE id=?", id);
        if (
          old &&
          (old.anchor_date !== data.anchor_date ||
            old.interval_count !== data.interval_count ||
            old.interval_unit !== data.interval_unit)
        )
          throw Error(
            "Archive this rule before changing a posted recurrence schedule",
          );
      }
      if (
        kind === "subscriptions" &&
        id &&
        (await tx.getFirstAsync(
          "SELECT subscription_id FROM subscription_payments WHERE subscription_id=?",
          id,
        ))
      ) {
        const old = await tx.getFirstAsync<Subscription>(
          "SELECT * FROM subscriptions WHERE id=?",
          id,
        );
        if (
          old &&
          (old.anchor_date !== data.anchor_date ||
            old.interval_count !== data.interval_count ||
            old.interval_unit !== data.interval_unit)
        )
          throw Error(
            "Create a new subscription to change the paid billing schedule",
          );
      }
      const fields = Object.keys(data).filter((k) => data[k] !== undefined);
      await tx.runAsync(
        `INSERT INTO ${table}(id,${fields.join(",")}) VALUES(?,${fields.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${fields.map((k) => `${k}=excluded.${k}`).join(",")}`,
        key,
        ...fields.map((k) => data[k]!),
      );
      if (kind === "loans" && !preserveLoanSchedule) {
        const loan = data as unknown as Omit<Loan, "id">;
        const schedule = amortization(
          loan.principal_minor,
          loan.annual_rate_bps,
          loan.tenure_months,
          loan.emi_minor,
          loan.first_due_date,
        );
        await tx.runAsync("DELETE FROM emi_payments WHERE loan_id=?", key);
        for (const row of schedule)
          await tx.runAsync(
            "INSERT INTO emi_payments(id,loan_id,due_date,amount_minor,principal_minor,interest_minor) VALUES(?,?,?,?,?,?)",
            uid(),
            key,
            row.due_date,
            row.amount_minor,
            row.principal_minor,
            row.interest_minor,
          );
      }
    });
    return key;
  },
  async archive(kind: PlanKind, id: string) {
    const table = planTables[kind];
    if (kind === "budgets")
      await db().runAsync("DELETE FROM budgets WHERE id=?", id);
    else
      await db().runAsync(
        `UPDATE ${table} SET ${"is_active=0"} WHERE id=?`,
        id,
      );
  },
  async payEMI(id: string, accountId?: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const e = await tx.getFirstAsync<EMIPayment>(
        "SELECT * FROM emi_payments WHERE id=? AND status='PENDING'",
        id,
      );
      if (!e) throw Error("Already paid");
      const loan = await tx.getFirstAsync<Loan>(
        "SELECT * FROM loans WHERE id=? AND is_active=1",
        e.loan_id,
      );
      if (!loan) throw Error("Loan unavailable");
      const tid = await writeEntry(
        tx,
        {
          accountId: accountId ?? loan.account_id,
          type: "EXPENSE",
          amount: e.amount_minor / 100,
          categoryId: loan.category_id ?? undefined,
          note: `${loan.title} • EMI ${e.due_date}`,
        },
        uid(),
        "COMMITMENT",
      );
      await tx.runAsync(
        "UPDATE emi_payments SET status='PAID',transaction_id=? WHERE id=? AND status='PENDING'",
        tid,
        id,
      );
    });
  },
  async paySubscription(id: string, date: string, accountId?: string) {
    validDate.parse(date);
    await db().withExclusiveTransactionAsync(async (tx) => {
      const s = await tx.getFirstAsync<Subscription>(
        "SELECT * FROM subscriptions WHERE id=? AND is_active=1",
        id,
      );
      if (!s) throw Error("Subscription unavailable");
      if (
        !occurrences(
          s.anchor_date,
          s.interval_count,
          s.interval_unit,
          date,
          date,
        ).includes(date)
      )
        throw Error("This date is not a scheduled renewal");
      const tid = await writeEntry(
        tx,
        {
          accountId: accountId ?? s.account_id,
          type: "EXPENSE",
          amount: s.amount_minor / 100,
          categoryId: s.category_id ?? undefined,
          note: `${s.title} • renewal ${date}`,
        },
        uid(),
        "COMMITMENT",
      );
      await tx.runAsync(
        "INSERT INTO subscription_payments VALUES(?,?,?)",
        id,
        date,
        tid,
      );
    });
  },
  async contribute(
    goalId: string,
    accountId: string,
    amount: number,
    note: string,
    transferTo?: string,
  ) {
    minor.parse(Math.abs(amount));
    await db().withExclusiveTransactionAsync(async (tx) => {
      const goal = await tx.getFirstAsync<Goal>(
        "SELECT * FROM savings_goals WHERE id=? AND is_active=1",
        goalId,
      );
      if (!goal) throw Error("Goal unavailable");
      const total = await tx.getFirstAsync<{ n: number }>(
        "SELECT COALESCE(SUM(amount_minor),0) n FROM goal_contributions WHERE goal_id=? AND account_id=?",
        goalId,
        accountId,
      );
      if (amount < 0 && Math.abs(amount) > (total?.n ?? 0))
        throw Error("Cannot release more than reserved in this account");
      const a = await tx.getFirstAsync<Account>(
        "SELECT * FROM account_balances WHERE id=? AND is_active=1",
        accountId,
      );
      if (!a) throw Error("Account unavailable");
      const reserved = await tx.getFirstAsync<{ n: number }>(
        "SELECT COALESCE(SUM(c.amount_minor),0) n FROM goal_contributions c JOIN savings_goals g ON g.id=c.goal_id WHERE c.account_id=? AND g.is_active=1",
        accountId,
      );
      if (amount > 0 && amount > a.current_balance_minor - (reserved?.n ?? 0))
        throw Error("Not enough unreserved balance in this account");
      let tid: string | null = null;
      let owner = accountId;
      if (transferTo && transferTo !== accountId && amount > 0) {
        tid = await writeEntry(tx, {
          accountId,
          destinationId: transferTo,
          type: "TRANSFER",
          amount: amount / 100,
          note: `Savings • ${goal.title}`,
        });
        owner = transferTo;
      }
      await tx.runAsync(
        "INSERT INTO goal_contributions(id,goal_id,account_id,amount_minor,contribution_date,note,transaction_id) VALUES(?,?,?,?,?,?,?)",
        uid(),
        goalId,
        owner,
        amount,
        new Date().toISOString(),
        note,
        tid,
      );
    });
  },
  async dismissReminder(id: string) {
    await db().runAsync(
      "UPDATE reminders SET status='DISMISSED' WHERE id=?",
      id,
    );
  },
};
