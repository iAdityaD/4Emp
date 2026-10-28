import { db, uid } from "../db/connection";
import { cents } from "../domain/finance";
import { Commitment } from "../domain/models";
export const CommitmentRepository = {
  all: () =>
    db().getAllAsync<Commitment>(
      "SELECT *,amount_minor/100.0 AS amount FROM fixed_commitments WHERE is_active=1 ORDER BY due_day_of_month",
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
      "INSERT INTO fixed_commitments(id,title,amount_minor,due_day_of_month,account_id,commitment_type) VALUES(?,?,?,?,?,?)",
      uid(),
      c.title,
      cents(c.amount),
      c.due_day_of_month,
      c.account_id,
      c.commitment_type,
    );
  },
  async update(id: string, c: Omit<Commitment, "id" | "is_active">) {
    if (
      !c.title.trim() ||
      cents(c.amount) <= 0 ||
      !Number.isInteger(c.due_day_of_month) ||
      c.due_day_of_month < 1 ||
      c.due_day_of_month > 31
    )
      throw Error("Choose a name, amount and due day");
    if (
      !(await db().getFirstAsync(
        "SELECT id FROM accounts WHERE id=? AND is_active=1",
        c.account_id,
      ))
    )
      throw Error("Choose an active account");
    await db().runAsync(
      "UPDATE fixed_commitments SET title=?,amount_minor=?,due_day_of_month=?,account_id=?,commitment_type=? WHERE id=?",
      c.title.trim(),
      cents(c.amount),
      c.due_day_of_month,
      c.account_id,
      c.commitment_type,
      id,
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
        "INSERT INTO transactions(id,account_id,type,amount_minor,category_id,transaction_date,note,reimbursement_status,ledger_kind,created_at) VALUES(?,?,'EXPENSE',?,'bills',?,?,'NOT_APPLICABLE','COMMITMENT',?)",
        id,
        c.account_id,
        cents(c.amount),
        new Date().toISOString(),
        c.title,
        Date.now(),
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
