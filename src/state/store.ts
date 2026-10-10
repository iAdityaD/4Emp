import { create } from "zustand";
import {
  Shift,
  Break,
  Account,
  Category,
  Transaction,
  Commitment,
  Holiday,
  CalendarMark,
  Settings,
  defaultSettings,
} from "../domain/models";
import { ShiftRepository } from "../repositories/ShiftRepository";
import { AccountRepository } from "../repositories/AccountRepository";
import { TransactionRepository } from "../repositories/TransactionRepository";
import { CommitmentRepository } from "../repositories/CommitmentRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { syncNotifications } from "../services/notifications";
import { notificationPlan } from "../services/notificationPlan";
import { dateKey } from "../domain/shift";
import * as Notifications from "expo-notifications";
import { native } from "../services/native";
interface State {
  ready: boolean;
  busy: boolean;
  error: string | null;
  alarmWarning: string | null;
  settings: Settings;
  shifts: Shift[];
  breaks: Break[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  commitments: Commitment[];
  payments: { commitment_id: string; cycle: string; transaction_id: string }[];
  holidays: Holiday[];
  marks: CalendarMark[];
  refresh(): Promise<void>;
  mutate(action: () => Promise<unknown>): Promise<boolean>;
  configure<K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ): Promise<void>;
}
export const useStore = create<State>((set, get) => ({
  ready: false,
  busy: false,
  error: null,
  alarmWarning: null,
  settings: defaultSettings,
  shifts: [],
  breaks: [],
  accounts: [],
  categories: [],
  transactions: [],
  commitments: [],
  payments: [],
  holidays: [],
  marks: [],
  async refresh() {
    await ShiftRepository.recover();
    const [
      settings,
      shifts,
      breaks,
      accounts,
      categories,
      transactions,
      commitments,
      payments,
      holidays,
      marks,
    ] = await Promise.all([
      SettingsRepository.load(),
      ShiftRepository.all(),
      ShiftRepository.breaks(),
      AccountRepository.all(),
      TransactionRepository.categories(),
      TransactionRepository.all(),
      CommitmentRepository.all(),
      CommitmentRepository.payments(),
      HolidayRepository.all(),
      HolidayRepository.marks(),
    ]);
    set({
      settings,
      shifts,
      breaks,
      accounts,
      categories,
      transactions,
      commitments,
      payments,
      holidays,
      marks,
      ready: true,
    });
    if (
      marks.some((m) => m.work_date === dateKey() && m.kind !== "WORKED") ||
      holidays.some((h) => h.holiday_date === dateKey() && !h.is_optional)
    )
      await Notifications.dismissAllNotificationsAsync();
    try {
      await native?.syncCutoffs(
        JSON.stringify(
          shifts
            .filter((x) => x.status === "ACTIVE" && x.cutoff_at)
            .map((x) => ({ id: x.id, at: Date.parse(x.cutoff_at!) })),
        ),
      );
      set({
        alarmWarning: await syncNotifications(
          notificationPlan(
            shifts,
            breaks,
            settings,
            marks,
            holidays,
            Date.now(),
          ),
        ),
      });
    } catch (e) {
      set({
        alarmWarning: `Scheduling failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  },
  async mutate(action) {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      await action();
      await get().refresh();
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      set({ busy: false });
    }
  },
  async configure(key, value) {
    await get().mutate(() => SettingsRepository.save(key, value));
  },
}));
