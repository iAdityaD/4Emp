import { create } from "zustand";
import { dateKey } from "../domain/shift";
export const useActivityFilters = create<{
  account: string;
  month: string;
  allDates: boolean;
  set: (values: { account: string; month: string; allDates: boolean }) => void;
}>((set) => ({
  account: "",
  month: dateKey().slice(0, 7),
  allDates: false,
  set,
}));
