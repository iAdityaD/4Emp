import { assertTransactionEditable } from "../domain/transactionPolicy";
import { z } from "zod";
import { db, uid } from "../db/connection";
import type { SQLiteDatabase } from "expo-sqlite";
import { Transaction, Category } from "../domain/models";
import { cents } from "../domain/finance";
export interface Entry {
  accountId: string;
  destinationId?: string;
  type: Transaction["type"];
  amount: number;
  categoryId?: string;
  date?: string;
  note?: string;
  tags?: string[];
  reimbursable?: boolean;
  split?: { total: number; share: number; groupId?: string };
}
const entrySchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: z.number().finite().positive().max(9e10),
  note: z.string().max(2000).optional(),
});
export async function writeEntry(
  tx: SQLiteDatabase,
  e: Entry,
  id = uid(),
  kind: Transaction["ledger_kind"] = "PERSONAL",
) {
  entrySchema.parse(e);
  const minor = cents(e.amount);
  if (minor <= 0) throw Error("Amount must be at least 0.01");
  if (
    e.type === "TRANSFER" &&
    (!e.destinationId || e.destinationId === e.accountId)
  )
    throw Error("Choose different source and destination accounts");
  if (e.type !== "EXPENSE" && (e.reimbursable || e.split))
    throw Error("Only expenses can be reimbursed or split");
  if (e.reimbursable && e.split) throw Error("Choose one receivable type");
  if (
    e.split &&
    (cents(e.split.total) !== minor ||
      !Number.isFinite(e.split.share) ||
      e.split.share < 0 ||
      e.split.share > e.amount)
  )
    throw Error("Invalid split share");
  const when = e.date ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(when)) || Date.parse(when) > Date.now())
    throw Error("Choose a valid date in the past");
  for (const account of [
    e.accountId,
    ...(e.type === "TRANSFER" ? [e.destinationId!] : []),
  ])
    if (
      !(await tx.getFirstAsync(
        "SELECT id FROM accounts WHERE id=? AND is_active=1",
        account,
      ))
    )
      throw Error("Account unavailable");
  if (e.categoryId) {
    const c = await tx.getFirstAsync<Category>(
      "SELECT * FROM categories WHERE id=? AND is_active=1",
      e.categoryId,
    );
    if (!c) throw Error("Category unavailable");
    if (c.kind !== "BOTH" && e.type !== "TRANSFER" && c.kind !== e.type)
      throw Error("Category does not match transaction type");
  }
  await tx.runAsync(
    `INSERT INTO transactions(id,account_id,destination_account_id,type,amount_minor,category_id,transaction_date,note,is_reimbursable,reimbursement_status,is_split,split_group_id,split_total_minor,split_share_minor,tags,ledger_kind,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    e.accountId,
    e.type === "TRANSFER" ? e.destinationId! : null,
    e.type,
    minor,
    e.categoryId ?? null,
    new Date(when).toISOString(),
    e.note ?? null,
    e.reimbursable ? 1 : 0,
    e.reimbursable ? "PENDING" : "NOT_APPLICABLE",
    e.split ? 1 : 0,
    e.split?.groupId ?? null,
    e.split ? cents(e.split.total) : null,
    e.split ? cents(e.split.share) : null,
    JSON.stringify(e.tags ?? []),
    kind,
    Date.now(),
  );
  return id;
}
export const TransactionRepository = {
  all: () =>
    db().getAllAsync<Transaction>(
      "SELECT * FROM ledger ORDER BY transaction_date DESC,created_at DESC",
    ),
  categories: () =>
    db().getAllAsync<Category>("SELECT * FROM categories ORDER BY name"),
  async create(e: Entry) {
    let id = "";
    await db().withExclusiveTransactionAsync(async (tx) => {
      id = await writeEntry(tx, e);
    });
    return id;
  },
  async edit(id: string, e: Entry) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const old = await tx.getFirstAsync<Transaction>(
        "SELECT * FROM ledger WHERE id=?",
        id,
      );
      if (
        !old ||
        old.ledger_kind !== "PERSONAL" ||
        old.reimbursement_status === "SETTLED" ||
        old.is_split ||
        !!(await tx.getFirstAsync(
          "SELECT id FROM goal_contributions WHERE transaction_id=?",
          id,
        ))
      )
        throw Error(
          "Linked and settled entries are protected. Reverse them before editing.",
        );
      assertTransactionEditable(old.transaction_date);
      await tx.runAsync(
        "UPDATE accounts SET is_active=1 WHERE id=? OR id=?",
        old.account_id,
        old.destination_account_id,
      );
      const temp = await writeEntry(tx, e);
      await tx.runAsync(
        `UPDATE transactions SET account_id=?,destination_account_id=?,type=?,amount_minor=?,category_id=?,transaction_date=?,note=?,is_reimbursable=?,reimbursement_status=?,tags=? WHERE id=?`,
        e.accountId,
        e.type === "TRANSFER" ? e.destinationId! : null,
        e.type,
        cents(e.amount),
        e.categoryId ?? null,
        new Date(e.date ?? Date.now()).toISOString(),
        e.note ?? null,
        e.reimbursable ? 1 : 0,
        e.reimbursable ? "PENDING" : "NOT_APPLICABLE",
        JSON.stringify(e.tags ?? []),
        id,
      );
      await tx.runAsync("DELETE FROM transactions WHERE id=?", temp);
    });
  },
  async remove(id: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const old = await tx.getFirstAsync<Transaction>(
        "SELECT * FROM ledger WHERE id=?",
        id,
      );
      if (!old) throw Error("Entry unavailable");
      assertTransactionEditable(old.transaction_date);
      const linked = await tx.getAllAsync<{ transaction_date: string }>(
        "SELECT transaction_date FROM ledger WHERE linked_transaction_id=?",
        id,
      );
      for (const entry of linked)
        assertTransactionEditable(entry.transaction_date);
      if (
        await tx.getFirstAsync(
          "SELECT id FROM lending WHERE transaction_id=? UNION ALL SELECT id FROM lending_repayments WHERE transaction_id=?",
          id,
          id,
        )
      )
        throw Error(
          "Manage this entry from Lending to keep repayments consistent",
        );
      const involved = await tx.getAllAsync<{
        account_id: string;
        destination_account_id: string | null;
      }>(
        "SELECT account_id,destination_account_id FROM transactions WHERE id=? OR linked_transaction_id=?",
        id,
        id,
      );
      for (const account of involved)
        await tx.runAsync(
          "UPDATE accounts SET is_active=1 WHERE id=? OR id=?",
          account.account_id,
          account.destination_account_id,
        );
      if (old.ledger_kind === "REIMBURSEMENT") {
        await tx.runAsync(
          "UPDATE transactions SET reimbursement_status='PENDING' WHERE id=?",
          old.linked_transaction_id!,
        );
        await tx.runAsync(
          "UPDATE transactions SET linked_transaction_id=NULL WHERE id=?",
          id,
        );
      }
      await tx.runAsync(
        "UPDATE transactions SET voided_at=?,linked_transaction_id=NULL WHERE linked_transaction_id=? AND ledger_kind='REIMBURSEMENT'",
        Date.now(),
        id,
      );
      await tx.runAsync(
        "UPDATE transactions SET voided_at=? WHERE id=?",
        Date.now(),
        id,
      );
      await tx.runAsync(
        "UPDATE emi_payments SET status='PENDING',transaction_id=NULL WHERE transaction_id=?",
        id,
      );
      // Keep automatic subscription occurrence identities after reversal.
      // Manual plans can record the occurrence again; auto-post plans never regenerate it.
      await tx.runAsync(
        "DELETE FROM subscription_payments WHERE transaction_id=? AND subscription_id IN (SELECT id FROM subscriptions WHERE auto_post=0)",
        id,
      );
      await tx.runAsync(
        "DELETE FROM commitment_payments WHERE transaction_id=?",
        id,
      );
      await tx.runAsync(
        "DELETE FROM goal_contributions WHERE transaction_id=?",
        id,
      );
      // Keep occurrence identities when reversing salary/recurring entries: reopen must never regenerate deleted income.
    });
  },
  async settle(id: string, accountId: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const t = await tx.getFirstAsync<Transaction>(
        "SELECT * FROM ledger WHERE id=?",
        id,
      );
      if (!t || t.reimbursement_status !== "PENDING")
        throw Error("Already settled or unavailable");
      const sid = await writeEntry(
        tx,
        {
          accountId,
          type: "INCOME",
          amount: t.amount,
          note: "Employer reimbursement",
        },
        uid(),
        "REIMBURSEMENT",
      );
      await tx.runAsync(
        "UPDATE transactions SET linked_transaction_id=? WHERE id=?",
        id,
        sid,
      );
      await tx.runAsync(
        "UPDATE transactions SET reimbursement_status='SETTLED' WHERE id=?",
        id,
      );
    });
  },
};
