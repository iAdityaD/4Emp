import { assertTransactionEditable } from "../domain/transactionPolicy";
import { z } from "zod";
import { db, uid } from "../db/connection";
import { writeEntry } from "./TransactionRepository";
import { Lending } from "../features/planning/models";
import { minor, validDate } from "../features/planning/calculations";
import { dateKey } from "../domain/shift";
const schema = z.object({
  title: z.string().trim().min(1).max(80),
  amount_minor: minor,
  account_id: z.string().min(1),
  lent_date: validDate,
  due_date: validDate.nullable(),
  notes: z.string().max(2000).default(""),
});
export const LendingRepository = {
  async save(input: unknown, id?: string) {
    const r = schema.parse(input);
    if (r.lent_date > dateKey())
      throw Error("Choose today or an earlier lending date");
    if (r.due_date && r.due_date < r.lent_date)
      throw Error("Due date must follow the lending date");
    const key = id ?? uid();
    await db().withExclusiveTransactionAsync(async (tx) => {
      if (id) {
        const old = await tx.getFirstAsync<Lending>(
          "SELECT * FROM lending WHERE id=?",
          id,
        );
        if (!old) throw Error("Lending unavailable");
        if (
          old.amount_minor !== r.amount_minor ||
          old.account_id !== r.account_id ||
          old.lent_date !== r.lent_date
        )
          throw Error(
            "Original lending amount and account are fixed; record repayments separately",
          );
        await tx.runAsync(
          "UPDATE lending SET title=?,due_date=?,notes=? WHERE id=?",
          r.title,
          r.due_date,
          r.notes,
          id,
        );
      } else {
        const tid = await writeEntry(
          tx,
          {
            accountId: r.account_id,
            type: "EXPENSE",
            amount: r.amount_minor / 100,
            date: new Date(r.lent_date + "T00:00:00").toISOString(),
            note: `Lent to ${r.title}`,
          },
          uid(),
          "ADJUSTMENT",
        );
        await tx.runAsync(
          "INSERT INTO lending VALUES(?,?,?,?,?,?,?,?)",
          key,
          r.title,
          r.amount_minor,
          r.account_id,
          r.lent_date,
          r.due_date,
          r.notes,
          tid,
        );
      }
    });
    return key;
  },
  async repay(id: string, amount: number, accountId: string, date: string) {
    minor.parse(amount);
    validDate.parse(date);
    if (date > dateKey())
      throw Error("Choose today or an earlier repayment date");
    await db().withExclusiveTransactionAsync(async (tx) => {
      const r = await tx.getFirstAsync<Lending>(
        "SELECT * FROM lending WHERE id=?",
        id,
      );
      if (!r) throw Error("Lending unavailable");
      if (date < r.lent_date) throw Error("Repayment cannot precede lending");
      const paid = await tx.getFirstAsync<{ n: number }>(
        "SELECT COALESCE(SUM(amount_minor),0) n FROM lending_repayments WHERE lending_id=?",
        id,
      );
      if (amount > r.amount_minor - (paid?.n ?? 0))
        throw Error("Repayment exceeds the outstanding amount");
      const tid = await writeEntry(
        tx,
        {
          accountId,
          type: "INCOME",
          amount: amount / 100,
          date: new Date(date + "T00:00:00").toISOString(),
          note: `Repayment from ${r.title}`,
        },
        uid(),
        "ADJUSTMENT",
      );
      await tx.runAsync(
        "INSERT INTO lending_repayments VALUES(?,?,?,?,?,?)",
        uid(),
        id,
        amount,
        accountId,
        date,
        tid,
      );
    });
  },
  async undoRepayment(id: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const r = await tx.getFirstAsync<{ transaction_id: string }>(
        "SELECT transaction_id FROM lending_repayments WHERE id=?",
        id,
      );
      if (!r) throw Error("Repayment unavailable");
      const entry = await tx.getFirstAsync<{ transaction_date: string }>(
        "SELECT transaction_date FROM ledger WHERE id=?",
        r.transaction_id,
      );
      if (!entry) throw Error("Entry unavailable");
      assertTransactionEditable(entry.transaction_date);
      await tx.runAsync(
        "UPDATE transactions SET voided_at=? WHERE id=?",
        Date.now(),
        r.transaction_id,
      );
      await tx.runAsync("DELETE FROM lending_repayments WHERE id=?", id);
    });
  },
  async remove(id: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const entries = await tx.getAllAsync<{ transaction_date: string }>(
        "SELECT transaction_date FROM ledger WHERE id IN (SELECT transaction_id FROM lending WHERE id=? UNION ALL SELECT transaction_id FROM lending_repayments WHERE lending_id=?)",
        id,
        id,
      );
      for (const entry of entries)
        assertTransactionEditable(entry.transaction_date);
      await tx.runAsync(
        "UPDATE transactions SET voided_at=? WHERE id IN (SELECT transaction_id FROM lending WHERE id=? UNION ALL SELECT transaction_id FROM lending_repayments WHERE lending_id=?)",
        Date.now(),
        id,
        id,
      );
      await tx.runAsync(
        "DELETE FROM lending_repayments WHERE lending_id=?",
        id,
      );
      await tx.runAsync("DELETE FROM lending WHERE id=?", id);
    });
  },
};
