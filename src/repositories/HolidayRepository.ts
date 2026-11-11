import { db, uid } from "../db/connection";
import { Holiday, CalendarMark } from "../domain/models";
import { dateKey, localDate } from "../domain/shift";
/** Calendar keys are local dates; never round-trip them through UTC. */
const realDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && dateKey(localDate(date)) === date;
export const HolidayRepository = {
  all: () =>
    db().getAllAsync<Holiday>(
      "SELECT * FROM company_holidays ORDER BY holiday_date",
    ),
  marks: () => db().getAllAsync<CalendarMark>("SELECT * FROM calendar_marks"),
  async add(date: string, title: string, optional: boolean) {
    if (!realDate(date) || !title.trim())
      throw Error("Enter a valid YYYY-MM-DD date and title");
    await db().runAsync(
      "INSERT INTO company_holidays(id,holiday_date,title,is_optional) VALUES(?,?,?,?) ON CONFLICT(holiday_date) DO UPDATE SET title=excluded.title,is_optional=excluded.is_optional",
      uid(),
      date,
      title.trim(),
      optional ? 1 : 0,
    );
  },
  async remove(id: string) {
    await db().runAsync("DELETE FROM company_holidays WHERE id=?", id);
  },
  async mark(date: string, kind: CalendarMark["kind"] | null, note = "") {
    if (!realDate(date)) throw Error("Choose a valid calendar date");
    if (kind)
      await db().runAsync(
        "INSERT INTO calendar_marks(work_date,kind,note) VALUES(?,?,?) ON CONFLICT(work_date) DO UPDATE SET kind=excluded.kind,note=excluded.note",
        date,
        kind,
        note,
      );
    else
      await db().runAsync("DELETE FROM calendar_marks WHERE work_date=?", date);
  },
};
