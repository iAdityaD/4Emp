import { db, uid } from "../db/connection";
import { Shift, Break, ShiftType, Settings } from "../domain/models";
import {
  cutoffWindow,
  shiftTarget,
  workDate,
  dateKey,
  metrics,
} from "../domain/shift";
export const ShiftRepository = {
  all: () =>
    db().getAllAsync<Shift>(
      "SELECT * FROM work_shifts ORDER BY first_swipe_in DESC",
    ),
  breaks: () =>
    db().getAllAsync<Break>("SELECT * FROM shift_breaks ORDER BY break_start"),
  async recover(now = Date.now()) {
    await db().runAsync(
      "UPDATE work_shifts SET status='NEEDS_REVIEW' WHERE status='ACTIVE' AND cutoff_at IS NOT NULL AND cutoff_at<=?",
      new Date(now).toISOString(),
    );
  },
  async start(type: ShiftType, custom: number, settings: Settings) {
    await this.recover();
    const existing = await db().getFirstAsync<Shift>(
      "SELECT * FROM work_shifts WHERE status IN ('ACTIVE','NEEDS_REVIEW')",
    );
    if (existing) throw Error("Complete or review the previous shift first");
    const now = Date.now(),
      target = shiftTarget(type, settings.baseline, custom);
    if (
      type !== "OPEN_ENDED" &&
      (!Number.isFinite(target) || target <= 0 || target > 1440)
    )
      throw Error("Choose a target between 1 minute and 24 hours");
    await db().runAsync(
      "INSERT INTO work_shifts(id,work_date,tracking_mode,shift_type,target_minutes,buffer_minutes,first_swipe_in,status,created_at,cutoff_at) VALUES(?,?,?,?,?,?,?,'ACTIVE',?,?)",
      uid(),
      workDate(now, settings.cutoff),
      settings.mode,
      type,
      target,
      type === "OPEN_ENDED" ? 0 : settings.buffer,
      new Date(now).toISOString(),
      now,
      new Date(cutoffWindow(now, settings.cutoff).end).toISOString(),
    );
  },
  async toggleBreak(shift: Shift) {
    if (shift.status !== "ACTIVE" || metrics(shift, [], Date.now()).review)
      throw Error("This shift needs review");
    await db().withExclusiveTransactionAsync(async (tx) => {
      const open = await tx.getFirstAsync<Break>(
        "SELECT * FROM shift_breaks WHERE shift_id=? AND break_end IS NULL",
        shift.id,
      );
      const now = Date.now();
      if (open)
        await tx.runAsync(
          "UPDATE shift_breaks SET break_end=?,duration_minutes=? WHERE id=?",
          new Date(now).toISOString(),
          (now - Date.parse(open.break_start)) / 60000,
          open.id,
        );
      else
        await tx.runAsync(
          "INSERT INTO shift_breaks(id,shift_id,break_start) VALUES(?,?,?)",
          uid(),
          shift.id,
          new Date(now).toISOString(),
        );
    });
  },
  async complete(shift: Shift, end = Date.now(), notes?: string) {
    await this.edit(
      shift,
      Date.parse(shift.first_swipe_in),
      end,
      notes ?? shift.notes ?? "",
    );
  },
  async edit(shift: Shift, start: number, end: number | null, notes: string) {
    if (
      !Number.isFinite(start) ||
      start > Date.now() ||
      (end !== null &&
        (!Number.isFinite(end) || end < start || end > Date.now()))
    )
      throw Error("Enter valid times in the past");
    const breaks = (await this.breaks()).filter((b) => b.shift_id === shift.id);
    if (
      breaks.some(
        (b) =>
          Date.parse(b.break_start) < start ||
          (end !== null &&
            (b.break_end
              ? Date.parse(b.break_end)
              : Date.parse(b.break_start)) > end),
      )
    )
      throw Error("Times must contain all recorded breaks");
    const other = await db().getFirstAsync<Shift>(
      "SELECT * FROM work_shifts WHERE id<>? AND first_swipe_in<? AND COALESCE(last_swipe_out,cutoff_at)>?",
      shift.id,
      new Date(
        end ?? Date.parse(shift.cutoff_at ?? new Date().toISOString()),
      ).toISOString(),
      new Date(start).toISOString(),
    );
    if (other) throw Error("Shift times overlap");
    await db().withExclusiveTransactionAsync(async (tx) => {
      if (end !== null) {
        await tx.runAsync(
          "UPDATE shift_breaks SET break_end=?,duration_minutes=(julianday(?)-julianday(break_start))*1440 WHERE shift_id=? AND break_end IS NULL",
          new Date(end).toISOString(),
          new Date(end).toISOString(),
          shift.id,
        );
      }
      await tx.runAsync(
        "UPDATE work_shifts SET first_swipe_in=?,last_swipe_out=?,notes=?,status=? WHERE id=?",
        new Date(start).toISOString(),
        end === null ? null : new Date(end).toISOString(),
        notes,
        end === null ? shift.status : "COMPLETED",
        shift.id,
      );
    });
  },
  async changeTarget(shift: Shift, minutes: number) {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440)
      throw Error("Target must be 1 minute to 24 hours");
    await db().runAsync(
      "UPDATE work_shifts SET target_minutes=? WHERE id=?",
      minutes,
      shift.id,
    );
  },
};
