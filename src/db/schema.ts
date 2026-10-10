// Migration 1 preserves the supplied DDL; migration 2 adds audited domain metadata.
export const migrations = [
  `CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE work_shifts (id TEXT PRIMARY KEY, work_date TEXT NOT NULL, tracking_mode TEXT CHECK(tracking_mode IN ('GROSS','NET')), shift_type TEXT CHECK(shift_type IN ('OFFICE','WFH','HALF_DAY','CUSTOM','OPEN_ENDED')), target_minutes INTEGER NOT NULL, buffer_minutes INTEGER NOT NULL DEFAULT 5, first_swipe_in TEXT NOT NULL, last_swipe_out TEXT, status TEXT CHECK(status IN ('ACTIVE','COMPLETED','NEEDS_REVIEW')), notes TEXT, created_at INTEGER NOT NULL);
CREATE TABLE shift_breaks (id TEXT PRIMARY KEY, shift_id TEXT NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE, break_start TEXT NOT NULL, break_end TEXT, duration_minutes INTEGER DEFAULT 0);
CREATE TABLE company_holidays (id TEXT PRIMARY KEY, holiday_date TEXT NOT NULL UNIQUE, title TEXT NOT NULL, is_optional BOOLEAN DEFAULT 0);
CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, account_type TEXT CHECK(account_type IN ('BANK_1','BANK_2','CASH')), starting_balance REAL NOT NULL DEFAULT 0.0, current_balance REAL NOT NULL DEFAULT 0.0, color_hex TEXT NOT NULL, is_active BOOLEAN DEFAULT 1);
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon_name TEXT NOT NULL, color_hex TEXT NOT NULL, is_system BOOLEAN DEFAULT 1);
CREATE TABLE transactions (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), destination_account_id TEXT REFERENCES accounts(id), type TEXT CHECK(type IN ('EXPENSE','INCOME','TRANSFER')), amount REAL NOT NULL, category_id TEXT REFERENCES categories(id), transaction_date TEXT NOT NULL, note TEXT, is_reimbursable BOOLEAN DEFAULT 0, reimbursement_status TEXT CHECK(reimbursement_status IN ('NOT_APPLICABLE','PENDING','SETTLED')), is_split BOOLEAN DEFAULT 0, split_group_id TEXT, split_total_amount REAL, split_my_share REAL, split_notes TEXT, created_at INTEGER NOT NULL);
CREATE TABLE fixed_commitments (id TEXT PRIMARY KEY, title TEXT NOT NULL, amount REAL NOT NULL, due_day_of_month INTEGER NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), commitment_type TEXT CHECK(commitment_type IN ('EMI','SUBSCRIPTION','RENT','OTHER')), is_active BOOLEAN DEFAULT 1);
CREATE INDEX idx_shifts_date ON work_shifts(work_date);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_acc ON transactions(account_id);`,
  `ALTER TABLE work_shifts ADD COLUMN cutoff_at TEXT;
ALTER TABLE transactions ADD COLUMN ledger_kind TEXT NOT NULL DEFAULT 'PERSONAL' CHECK(ledger_kind IN ('PERSONAL','REIMBURSEMENT','ADJUSTMENT','COMMITMENT'));
ALTER TABLE transactions ADD COLUMN linked_transaction_id TEXT REFERENCES transactions(id);
ALTER TABLE transactions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX idx_reimbursement_once ON transactions(linked_transaction_id) WHERE ledger_kind='REIMBURSEMENT';
CREATE TABLE commitment_payments (commitment_id TEXT NOT NULL REFERENCES fixed_commitments(id), cycle TEXT NOT NULL, transaction_id TEXT NOT NULL REFERENCES transactions(id), PRIMARY KEY(commitment_id,cycle));
CREATE TABLE calendar_marks (work_date TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('LEAVE','NON_WORKING','WORKED')), note TEXT NOT NULL DEFAULT '');
CREATE INDEX idx_break_shift ON shift_breaks(shift_id);
CREATE INDEX idx_shift_timestamp ON work_shifts(first_swipe_in);
CREATE UNIQUE INDEX idx_single_active ON work_shifts(status) WHERE status='ACTIVE';
CREATE TABLE schema_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);`,
];
export const backupTables = [
  "app_settings",
  "work_shifts",
  "shift_breaks",
  "company_holidays",
  "accounts",
  "categories",
  "transactions",
  "fixed_commitments",
  "commitment_payments",
  "calendar_marks",
  "schema_metadata",
] as const;
