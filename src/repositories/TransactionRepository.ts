import { db, uid } from "../db/connection";
import { Transaction, Account, Category } from "../domain/models";
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
export const TransactionRepository = {
  all: () =>
    db().getAllAsync<Transaction>(
      "SELECT * FROM transactions ORDER BY transaction_date DESC,created_at DESC",
    ),
  categories: () =>
    db().getAllAsync<Category>(
      "SELECT * FROM categories ORDER BY is_system DESC,name",
    ),
  async create(e: Entry) {
    const amount = cents(e.amount) / 100;
    if (amount <= 0) throw Error("Amount must be positive");
    if (
      e.type === "TRANSFER" &&
      (!e.destinationId || e.destinationId === e.accountId)
    )
      throw Error("Select a different destination account");
    if (e.type !== "EXPENSE" && (e.reimbursable || e.split))
      throw Error("Only expenses can be reimbursed or split");
    if (e.reimbursable && e.split)
      throw Error("Use one receivable type per transaction");
    if (
      e.split &&
      (cents(e.split.total) !== cents(amount) ||
        e.split.share < 0 ||
        e.split.share > amount)
    )
      throw Error("Invalid split share");
    const inputDate = e.date ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(inputDate)))
      throw Error("Enter a valid date");
    const when = new Date(inputDate).toISOString();
    if (!Number.isFinite(Date.parse(when)) || Date.parse(when) > Date.now())
      throw Error("Choose a valid transaction date in the past");
    const id = uid();
    await db().withExclusiveTransactionAsync(async (tx) => {
      const a = await tx.getFirstAsync<Account>(
        "SELECT * FROM accounts WHERE id=? AND is_active=1",
        e.accountId,
      );
      if (!a) throw Error("Account unavailable");
      if (
        e.type === "TRANSFER" &&
        !(await tx.getFirstAsync<Account>(
          "SELECT * FROM accounts WHERE id=? AND is_active=1",
          e.destinationId!,
        ))
      )
        throw Error("Destination unavailable");
      await tx.runAsync(
        "INSERT INTO transactions(id,account_id,destination_account_id,type,amount,category_id,transaction_date,note,is_reimbursable,reimbursement_status,is_split,split_group_id,split_total_amount,split_my_share,tags,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        e.accountId,
        e.type === "TRANSFER" ? e.destinationId! : null,
        e.type,
        amount,
        e.categoryId ?? null,
        when,
        e.note ?? null,
        e.reimbursable ? 1 : 0,
        e.reimbursable ? "PENDING" : "NOT_APPLICABLE",
        e.split ? 1 : 0,
        e.split?.groupId ?? null,
        e.split?.total ?? null,
        e.split?.share ?? null,
        JSON.stringify(e.tags ?? []),
        Date.now(),
      );
      const sign = e.type === "INCOME" ? 1 : -1;
      await tx.runAsync(
        "UPDATE accounts SET current_balance=ROUND(current_balance+?,2) WHERE id=?",
        sign * amount,
        e.accountId,
      );
      if (e.type === "TRANSFER")
        await tx.runAsync(
          "UPDATE accounts SET current_balance=ROUND(current_balance+?,2) WHERE id=?",
          amount,
          e.destinationId!,
        );
    });
    return id;
  },
  async settle(id: string, accountId: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      const t = await tx.getFirstAsync<Transaction>(
        "SELECT * FROM transactions WHERE id=?",
        id,
      );
      if (!t || t.reimbursement_status !== "PENDING")
        throw Error("This reimbursement is already settled or unavailable");
      if (
        !(await tx.getFirstAsync(
          "SELECT id FROM accounts WHERE id=? AND is_active=1",
          accountId,
        ))
      )
        throw Error("Account unavailable");
      await tx.runAsync(
        "INSERT INTO transactions(id,account_id,type,amount,transaction_date,note,reimbursement_status,ledger_kind,linked_transaction_id,created_at) VALUES(?,?,'INCOME',?,?,?,'NOT_APPLICABLE','REIMBURSEMENT',?,?)",
        uid(),
        accountId,
        t.amount,
        new Date().toISOString(),
        "Employer reimbursement",
        id,
        Date.now(),
      );
      await tx.runAsync(
        "UPDATE accounts SET current_balance=ROUND(current_balance+?,2) WHERE id=?",
        t.amount,
        accountId,
      );
      await tx.runAsync(
        "UPDATE transactions SET reimbursement_status='SETTLED' WHERE id=?",
        id,
      );
    });
  },
};
