export const TRANSACTION_EDIT_WINDOW = 24 * 60 * 60 * 1000;
export function transactionExpired(date: string, now = Date.now()) {
  const at = Date.parse(date);
  return !Number.isFinite(at) || now - at >= TRANSACTION_EDIT_WINDOW;
}
export function assertTransactionEditable(date: string) {
  if (transactionExpired(date))
    throw Error("Transactions are locked 24 hours after their recorded time");
}
