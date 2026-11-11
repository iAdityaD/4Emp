import type { Settings } from "./models";
const HOUR = 60 * 60 * 1000;
/** Used only when no user rule is supplied (for example in isolated tests). */
export const TRANSACTION_EDIT_WINDOW = 24 * HOUR;
type EditRules = Pick<Settings, "editLock" | "editWindowHours">;
/** The user's edit window in milliseconds; Infinity when locking is off. */
export function editWindow(rules: EditRules) {
  return rules.editLock ? rules.editWindowHours * HOUR : Infinity;
}
/** "24 hours", "1 hour" – shared by every message that mentions the window. */
export function editWindowText(windowMs = TRANSACTION_EDIT_WINDOW) {
  const hours = Math.round(windowMs / HOUR);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}
/** "24-hour" – the adjective form used in short status lines. */
export function editWindowAdjective(windowMs = TRANSACTION_EDIT_WINDOW) {
  return `${Math.round(windowMs / HOUR)}-hour`;
}
export function transactionExpired(
  date: string,
  now = Date.now(),
  windowMs = TRANSACTION_EDIT_WINDOW,
) {
  const at = Date.parse(date);
  return !Number.isFinite(at) || now - at >= windowMs;
}
export function assertTransactionEditable(
  date: string,
  windowMs = TRANSACTION_EDIT_WINDOW,
) {
  if (transactionExpired(date, Date.now(), windowMs))
    throw Error(
      `Transactions are locked ${editWindowText(windowMs)} after their recorded time`,
    );
}
