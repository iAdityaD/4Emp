import { db, uid } from "../db/connection";
import { PlanningRepository } from "../repositories/PlanningRepository";
import { writeEntry } from "../repositories/TransactionRepository";
import { dateKey, localDate } from "../domain/shift";
import {
  occurrences,
  salaryDates,
  budgetSpent,
} from "../features/planning/calculations";
import { cycle, obligationDate } from "../domain/finance";
import { Commitment, Transaction } from "../domain/models";
/** Every generated payment and its occurrence identity commit together. */
export async function reconcilePlans(
  now = Date.now(),
  notificationMinute = 540,
  cycleDay = 1,
) {
  const data = await PlanningRepository.load(),
    today = dateKey(now),
    horizonDate = new Date(now);
  horizonDate.setFullYear(horizonDate.getFullYear() + 1);
  const horizon = dateKey(horizonDate);
  await db().withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("UPDATE reminders SET enabled=0 WHERE kind<>'CUSTOM'");
    async function remind(
      kind: string,
      source: string,
      date: string,
      title: string,
      amount: number,
      lead = 0,
    ) {
      const due = localDate(date);
      due.setHours(
        Math.floor(notificationMinute / 60),
        notificationMinute % 60,
      );
      const at = new Date(due);
      at.setDate(at.getDate() - lead);
      await tx.runAsync(
        `INSERT INTO reminders(id,kind,source_id,occurrence_date,title,amount_minor,due_at,notification_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(kind,source_id,occurrence_date) DO UPDATE SET title=excluded.title,amount_minor=excluded.amount_minor,due_at=excluded.due_at,notification_at=excluded.notification_at,enabled=1`,
        `${kind}-${source}-${date}`,
        kind,
        source,
        date,
        title,
        amount,
        due.toISOString(),
        at.toISOString(),
      );
    }
    for (const r of data.salary.filter((r) => r.is_active))
      for (const date of salaryDates(r.start_date, r.payday, horizon)) {
        const done = await tx.getFirstAsync(
          "SELECT rule_id FROM salary_occurrences WHERE rule_id=? AND occurrence_date=?",
          r.id,
          date,
        );
        if (date <= today && r.auto_post && !done) {
          const tid = await writeEntry(tx, {
            accountId: r.account_id,
            type: "INCOME",
            amount: r.amount_minor / 100,
            categoryId: r.category_id ?? undefined,
            date: localDate(date).toISOString(),
            note: r.title,
          });
          await tx.runAsync(
            "INSERT INTO salary_occurrences VALUES(?,?,?)",
            r.id,
            date,
            tid,
          );
        } else if (!done)
          await remind(
            "SALARY",
            r.id,
            date,
            r.title,
            r.amount_minor,
            r.remind_days,
          );
      }
    for (const r of data.recurring.filter((r) => r.is_active))
      for (const date of occurrences(
        r.anchor_date,
        r.interval_count,
        r.interval_unit,
        r.anchor_date,
        horizon,
      )) {
        const done = await tx.getFirstAsync(
          "SELECT rule_id FROM recurring_occurrences WHERE rule_id=? AND occurrence_date=?",
          r.id,
          date,
        );
        if (date <= today && r.auto_post && !done) {
          const tid = await writeEntry(tx, {
            accountId: r.account_id,
            destinationId: r.destination_account_id ?? undefined,
            type: r.type,
            amount: r.amount_minor / 100,
            categoryId: r.category_id ?? undefined,
            date: localDate(date).toISOString(),
            note: r.title,
          });
          await tx.runAsync(
            "INSERT INTO recurring_occurrences VALUES(?,?,?)",
            r.id,
            date,
            tid,
          );
        } else if (!done)
          await remind("RECURRING", r.id, date, r.title, r.amount_minor);
      }
    for (const l of data.loans.filter((l) => l.is_active))
      for (const e of data.emis.filter(
        (e) =>
          e.loan_id === l.id && e.status === "PENDING" && e.due_date <= horizon,
      ))
        await remind(
          "EMI",
          l.id,
          e.due_date,
          l.title,
          e.amount_minor,
          l.remind_days,
        );
    for (const s of data.subscriptions.filter((s) => s.is_active))
      for (const date of occurrences(
        s.anchor_date,
        s.interval_count,
        s.interval_unit,
        s.anchor_date,
        horizon,
      ))
        if (
          !data.subscriptionPayments.some(
            (p) => p.subscription_id === s.id && p.occurrence_date === date,
          )
        )
          await remind(
            "SUBSCRIPTION",
            s.id,
            date,
            s.title,
            s.amount_minor,
            s.remind_days,
          );
    const legacy = await tx.getAllAsync<Commitment>(
      "SELECT *,amount_minor/100.0 AS amount FROM fixed_commitments WHERE is_active=1",
    );
    for (const bill of legacy) {
      for (let i = 0; i < 12; i++) {
        const origin = cycle(new Date(now), cycleDay).start;
        const year = origin.getFullYear(),
          month = origin.getMonth() + i;
        const point = new Date(
          year,
          month,
          Math.min(cycleDay, new Date(year, month + 1, 0).getDate()),
        );
        const window = cycle(point, cycleDay);
        const due = obligationDate(bill, window.start, window.end);
        if (
          due &&
          !(await tx.getFirstAsync(
            "SELECT commitment_id FROM commitment_payments WHERE commitment_id=? AND cycle=?",
            bill.id,
            window.key,
          ))
        )
          await remind(
            "BILL",
            bill.id,
            dateKey(due),
            bill.title,
            Math.round(bill.amount * 100),
            3,
          );
      }
    }
    const month = today.slice(0, 7),
      ledger = await tx.getAllAsync<Transaction>("SELECT * FROM ledger");
    for (const b of data.budgets.filter((b) => b.month === month)) {
      const spent = budgetSpent(ledger, month, b.category_id);
      for (const level of new Set([b.alert_percent, 100]))
        if (spent >= (b.limit_minor * level) / 100)
          await tx.runAsync(
            "INSERT OR IGNORE INTO budget_alerts(budget_id,level) VALUES(?,?)",
            b.id,
            level,
          );
    }
  });
}
export async function postPlanned(
  kind: "SALARY" | "RECURRING",
  source: string,
  date: string,
) {
  if (date > dateKey()) throw Error("Future entries cannot be posted early");
  const data = await PlanningRepository.load();
  await db().withExclusiveTransactionAsync(async (tx) => {
    const salary = kind === "SALARY";
    const r = salary
      ? data.salary.find((x) => x.id === source)
      : data.recurring.find((x) => x.id === source);
    if (!r || !r.is_active) throw Error("Plan unavailable");
    const valid = salary
      ? salaryDates(
          data.salary.find((x) => x.id === source)!.start_date,
          data.salary.find((x) => x.id === source)!.payday,
          date,
        ).includes(date)
      : occurrences(
          data.recurring.find((x) => x.id === source)!.anchor_date,
          data.recurring.find((x) => x.id === source)!.interval_count,
          data.recurring.find((x) => x.id === source)!.interval_unit,
          date,
          date,
        ).includes(date);
    if (!valid) throw Error("Date does not match this rule");
    const table = salary ? "salary_occurrences" : "recurring_occurrences";
    if (
      await tx.getFirstAsync(
        `SELECT rule_id FROM ${table} WHERE rule_id=? AND occurrence_date=?`,
        source,
        date,
      )
    )
      throw Error("Already posted");
    const rec = data.recurring.find((x) => x.id === source);
    const tid = await writeEntry(tx, {
      accountId: r.account_id,
      type: salary ? "INCOME" : rec!.type,
      destinationId: rec?.destination_account_id ?? undefined,
      amount: r.amount_minor / 100,
      categoryId: r.category_id ?? undefined,
      date: localDate(date).toISOString(),
      note: r.title,
    });
    await tx.runAsync(`INSERT INTO ${table} VALUES(?,?,?)`, source, date, tid);
  });
}
