import { db, uid } from "../db/connection";
import { Account } from "../domain/models";
import { cents } from "../domain/finance";
export const AccountRepository = {
  all: () =>
    db().getAllAsync<Account>(
      "SELECT * FROM accounts WHERE is_active=1 ORDER BY account_type",
    ),
  async rebalance(id: string, name: string, balance: number) {
    if (!name.trim()) throw Error("Enter an account name");
    const amount = cents(balance) / 100;
    await db().withExclusiveTransactionAsync(async (tx) => {
      const a = await tx.getFirstAsync<Account>(
        "SELECT * FROM accounts WHERE id=?",
        id,
      );
      if (!a) throw Error("Account not found");
      const delta = (cents(amount) - cents(a.current_balance)) / 100;
      if (delta !== 0)
        await tx.runAsync(
          "INSERT INTO transactions(id,account_id,type,amount,transaction_date,note,reimbursement_status,ledger_kind,created_at) VALUES(?,?,?,?,?,?,'NOT_APPLICABLE','ADJUSTMENT',?)",
          uid(),
          id,
          delta >= 0 ? "INCOME" : "EXPENSE",
          Math.abs(delta),
          new Date().toISOString(),
          "Manual balance correction",
          Date.now(),
        );
      await tx.runAsync(
        "UPDATE accounts SET name=?,current_balance=? WHERE id=?",
        name.trim(),
        amount,
        id,
      );
    });
  },
};
