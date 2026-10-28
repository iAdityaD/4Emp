import { z } from "zod";
import { db, uid } from "../db/connection";
const schema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["EXPENSE", "INCOME", "BOTH"]),
  icon_name: z.string().min(1),
  color_hex: z.string().regex(/^#[a-fA-F0-9]{6}$/),
});
export const CategoryRepository = {
  async save(input: unknown, id?: string) {
    const c = schema.parse(input);
    if (id) {
      const old = await db().getFirstAsync<{ kind: string }>(
        "SELECT kind FROM categories WHERE id=?",
        id,
      );
      if (old && old.kind !== c.kind) {
        for (const table of [
          "salary_rules",
          "recurring_rules",
          "loans",
          "subscriptions",
        ])
          if (
            await db().getFirstAsync(
              `SELECT id FROM ${table} WHERE category_id=? AND is_active=1`,
              id,
            )
          )
            throw Error(
              "Update active plans before changing this category’s type",
            );
      }
    }
    const key = id ?? uid();
    await db().runAsync(
      "INSERT INTO categories(id,name,kind,icon_name,color_hex,is_system) VALUES(?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,icon_name=excluded.icon_name,color_hex=excluded.color_hex,is_active=1",
      key,
      c.name,
      c.kind,
      c.icon_name,
      c.color_hex,
    );
    return key;
  },
  async archive(id: string) {
    for (const table of [
      "salary_rules",
      "recurring_rules",
      "loans",
      "subscriptions",
    ])
      if (
        await db().getFirstAsync(
          `SELECT id FROM ${table} WHERE category_id=? AND is_active=1`,
          id,
        )
      )
        throw Error("Update plans using this category before archiving");
    await db().runAsync("UPDATE categories SET is_active=0 WHERE id=?", id);
  },
};
