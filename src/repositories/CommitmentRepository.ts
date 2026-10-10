import { db, uid } from "../db/connection";
import { Commitment } from "../domain/models";
import { cents } from "../domain/finance";
export const CommitmentRepository = {
  all: () =>
    db().getAllAsync<Commitment>(
      "SELECT * FROM fixed_commitments WHERE is_active=1 ORDER BY due_day_of_month",
    ),
  payments: () =>
    db().getAllAsync<{
      commitment_id: string;
      cycle: string;
      transaction_id: string;
    }>("SELECT * FROM commitment_payments"),
  async add(c: Omit<Commitment, "id" | "is_active">) {
    if (
      !c.title.trim() ||
      cents(c.amount) <= 0 ||
      !Number.isInteger(c.due_day_of_month) ||
      c.due_day_of_month < 1 ||
      c.due_day_of_month > 31
    )
      throw Error("Enter a title, positive amount and due day 1–31");
    await db().runAsync(
      "INSERT INTO fixed_commitments(id,title,amount,due_day_of_month,account_id,commitment_type) VALUES(?,?,?,?,?,?)",
      uid(),
      c.title,
      cents(c.amount) / 100,
      c.due_day_of_month,
      c.account_id,
      c.commitment_type,
    );
  },
  async remove(id: string) {
    await db().runAsync(
      "UPDATE fixed_commitments SET is_active=0 WHERE id=?",
      id,
    );
  },
  async pay(c: Commitment, cycle: string) {
    await db().withExclusiveTransactionAsync(async (tx) => {
      if (
        await tx.getFirstAsync(
          "SELECT commitment_id FROM commitment_payments WHERE commitment_id=? AND cycle=?",
          c.id,
          cycle,
        )
      )
        throw Error("Already paid for this cycle");
      const id = uid();
      await tx.runAsync(
        "INSERT INTO transactions(id,account_id,type,amount,category_id,transaction_date,note,reimbursement_status,ledger_kind,created_at) VALUES(?,?,'EXPENSE',?,'bills',?,?,'NOT_APPLICABLE','COMMITMENT',?)",
        id,
        c.account_id,
        c.amount,
        new Date().toISOString(),
        c.title,
        Date.now(),
      );
      await tx.runAsync(
        "UPDATE accounts SET current_balance=ROUND(current_balance-?,2) WHERE id=?",
        c.amount,
        c.account_id,
      );
      await tx.runAsync(
        "INSERT INTO commitment_payments VALUES(?,?,?)",
        c.id,
        cycle,
        id,
      );
    });
  },
};
