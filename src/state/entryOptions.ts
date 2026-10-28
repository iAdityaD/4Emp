import { create } from "zustand";
export const useEntryOptions = create<{
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  note: string;
  tags: string;
  transaction_date: string;
  is_reimbursable: number;
  setField: (key: string, value: unknown) => void;
  reset: (type: "EXPENSE" | "INCOME" | "TRANSFER") => void;
}>((set) => ({
  type: "EXPENSE",
  note: "",
  tags: "",
  transaction_date: new Date().toISOString(),
  is_reimbursable: 0,
  setField: (key, value) => set({ [key]: value }),
  reset: (type) =>
    set({
      type,
      note: "",
      tags: "",
      transaction_date: new Date().toISOString(),
      is_reimbursable: 0,
    }),
}));
