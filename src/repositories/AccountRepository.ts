import { z } from "zod";
import { db, uid } from "../db/connection";
import { Account } from "../domain/models";
import { cents } from "../domain/finance";
import { writeEntry } from "./TransactionRepository";
export const AccountRepository = {
  all: () =>
    db().getAllAsync<Account>(
      "SELECT * FROM account_balances WHERE is_active=1 ORDER BY account_type,name",
    ),
  archived: () =>
    db().getAllAsync<Account>(
      "SELECT * FROM account_balances WHERE is_active=0 ORDER BY name",
    ),
  async save(
    id: string | null,
    name: string,
    type: Account["account_type"],
    color: string,
  ) {
    z.string().trim().min(1).max(60).parse(name);
    z.string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .parse(color);
    const key = id ?? uid();
    await db().runAsync(
      "INSERT INTO accounts(id,name,account_type,color_hex) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,account_type=excluded.account_type,color_hex=excluded.color_hex,is_active=1",
      key,
      name.trim(),
      type,
      color,
    );
    return key;
  },
  async archive(id: string) {
    const a = await db().getFirstAsync<Account>(
      "SELECT * FROM account_balances WHERE id=?",
      id,
    );
    if (!a || a.current_balance_minor !== 0)
      throw Error("Move or reconcile this account to zero before archiving");
    for (const table of [
      "salary_rules",
      "recurring_rules",
      "loans",
      "subscriptions",
      "fixed_commitments",
    ])
      if (
        await db().getFirstAsync(
          `SELECT id FROM ${table} WHERE account_id=? AND is_active=1`,
          id,
        )
      )
        throw Error("Update active financial plans using this account first");
    if (
      await db().getFirstAsync(
        "SELECT id FROM recurring_rules WHERE destination_account_id=? AND is_active=1",
        id,
      )
    )
      throw Error("Update recurring transfers using this destination first");
    const reserved = await db().getFirstAsync<{ n: number }>(
      "SELECT COALESCE(SUM(c.amount_minor),0) n FROM goal_contributions c JOIN savings_goals g ON g.id=c.goal_id WHERE c.account_id=? AND g.is_active=1",
      id,
    );
    if ((reserved?.n ?? 0) !== 0)
      throw Error("Release active goal reservations before archiving");
    await db().runAsync("UPDATE accounts SET is_active=0 WHERE id=?", id);
  },
  async rebalance(id: string, name: string, balance: number) {
    z.string().trim().min(1).parse(name);
    const target = cents(balance);
    await db().withExclusiveTransactionAsync(async (tx) => {
      const a = await tx.getFirstAsync<Account>(
        "SELECT * FROM account_balances WHERE id=?",
        id,
      );
      if (!a) throw Error("Account unavailable");
      const delta = target - a.current_balance_minor;
      if (delta)
        await writeEntry(
          tx,
          {
            accountId: id,
            type: delta > 0 ? "INCOME" : "EXPENSE",
            amount: Math.abs(delta) / 100,
            note: "Balance reconciliation",
          },
          uid(),
          "ADJUSTMENT",
        );
      await tx.runAsync(
        "UPDATE accounts SET name=? WHERE id=?",
        name.trim(),
        id,
      );
    });
  },
};
