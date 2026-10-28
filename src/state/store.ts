import { userMessage } from "../domain/errors";
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
import {
  syncNotifications,
  dismissWorkNotifications,
} from "../services/notifications";
import { notificationPlan } from "../services/notificationPlan";
import { dateKey, workDate } from "../domain/shift";
import * as Notifications from "expo-notifications";
import { native } from "../services/native";
import { PlanningData, emptyPlanning } from "../features/planning/models";
import { PlanningRepository } from "../repositories/PlanningRepository";
import { reconcilePlans } from "../services/recurrence";
import { db } from "../db/connection";
import { currency } from "../domain/finance";
interface State extends PlanningData {
  workProfileRevision: number;
  ready: boolean;
  busy: boolean;
  error: string | null;
  alarmWarning: string | null;
  settings: Settings;
  shifts: Shift[];
  breaks: Break[];
  accounts: Account[];
  archivedAccounts: Account[];
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
let refreshQueue: Promise<unknown> = Promise.resolve();
export const useStore = create<State>((set, get) => ({
  ...emptyPlanning,
  workProfileRevision: 0,
  ready: false,
  busy: false,
  error: null,
  alarmWarning: null,
  settings: defaultSettings,
  shifts: [],
  breaks: [],
  accounts: [],
  archivedAccounts: [],
  categories: [],
  transactions: [],
  commitments: [],
  payments: [],
  holidays: [],
  marks: [],
  async refresh() {
    const task = async () => {
      await ShiftRepository.recover();
      const initialSettings = await SettingsRepository.load();
      await reconcilePlans(
        Date.now(),
        initialSettings.financeReminderMinute,
        initialSettings.cycleDay,
      );
      const planning = await PlanningRepository.load();
      const archivedAccounts = await AccountRepository.archived();
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
        ...planning,
        archivedAccounts,
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
      const currentWorkDate =
        shifts.find((s) => s.status === "ACTIVE")?.work_date ??
        workDate(Date.now(), settings.cutoff);
      if (
        marks.some(
          (m) => m.work_date === currentWorkDate && m.kind !== "WORKED",
        ) ||
        holidays.some(
          (h) => h.holiday_date === currentWorkDate && !h.is_optional,
        )
      )
        await dismissWorkNotifications();
      try {
        await native?.syncCutoffs(
          JSON.stringify(
            shifts
              .filter((x) => x.status === "ACTIVE" && x.cutoff_at)
              .map((x) => ({ id: x.id, at: Date.parse(x.cutoff_at!) })),
          ),
        );
        const financeAlarms = planning.dueReminders
          .filter(
            (r) =>
              r.enabled &&
              r.status !== "DISMISSED" &&
              Date.parse(r.notification_at) > Date.now(),
          )
          .sort((a, b) => a.notification_at.localeCompare(b.notification_at))
          .slice(0, 30)
          .map((r) => ({
            channel: "finance" as const,
            id: r.id,
            at: Date.parse(r.notification_at),
            title: r.title,
            body: `${r.kind} • ${currency(r.amount_minor / 100, settings.currency)} • Due ${r.occurrence_date}`,
          }));
        const workAlarms = notificationPlan(
          shifts,
          breaks,
          settings,
          marks,
          holidays,
          Date.now(),
        );
        const prioritized = [
          ...workAlarms.filter(
            (a) => a.id.startsWith("shift-") || a.id.startsWith("cutoff-"),
          ),
          ...(settings.notifications && settings.financeNotifications
            ? financeAlarms
            : []),
          ...workAlarms.filter((a) => a.id.startsWith("reminder-")),
        ].slice(0, 60);
        const schedulingWarning = await syncNotifications(prioritized);
        set({ alarmWarning: schedulingWarning });
        await db().runAsync(
          "UPDATE reminders SET status='PENDING' WHERE status='SCHEDULED'",
        );
        if (!schedulingWarning) {
          for (const alarm of prioritized.filter(
            (a) => a.channel === "finance",
          ))
            await db().runAsync(
              "UPDATE reminders SET status='SCHEDULED' WHERE id=? AND status<>'DISMISSED'",
              alarm.id,
            );
          set({
            dueReminders: planning.dueReminders.map((r) => ({
              ...r,
              status:
                r.status === "DISMISSED"
                  ? r.status
                  : prioritized.some((a) => a.id === r.id)
                    ? "SCHEDULED"
                    : "PENDING",
            })),
          });
        }
        if (
          settings.notifications &&
          settings.financeNotifications &&
          (await Notifications.getPermissionsAsync()).granted
        ) {
          const pending = await db().getAllAsync<{
            budget_id: string;
            level: number;
            name: string;
          }>(
            "SELECT a.budget_id,a.level,c.name FROM budget_alerts a JOIN budgets b ON b.id=a.budget_id JOIN categories c ON c.id=b.category_id WHERE a.delivered_at IS NULL AND b.month=?",
            dateKey().slice(0, 7),
          );
          for (const alert of pending) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title:
                  alert.level === 100
                    ? "Budget limit reached"
                    : "Budget heads-up",
                body: `${alert.name} has reached ${alert.level}% of its monthly limit.`,
              },
              trigger: null,
            });
            await db().runAsync(
              "UPDATE budget_alerts SET delivered_at=? WHERE budget_id=? AND level=?",
              Date.now(),
              alert.budget_id,
              alert.level,
            );
          }
        }
      } catch (e) {
        set({
          alarmWarning: `Scheduling failed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    };
    const result = refreshQueue.catch(() => {}).then(task);
    refreshQueue = result;
    await result;
  },
  async mutate(action) {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      await action();
      await get().refresh();
      return true;
    } catch (e) {
      set({ error: userMessage(e) });
      return false;
    } finally {
      set({ busy: false });
    }
  },
  async configure(key, value) {
    await get().mutate(() => SettingsRepository.save(key, value));
  },
}));
