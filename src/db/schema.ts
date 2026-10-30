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
  `PRAGMA defer_foreign_keys=ON;
ALTER TABLE transactions ADD COLUMN amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(amount_minor)='integer' AND amount_minor>=0 AND amount_minor<=9000000000000);
UPDATE transactions SET amount_minor=CAST(ROUND(amount*100) AS INTEGER);
ALTER TABLE transactions DROP COLUMN amount;
ALTER TABLE transactions ADD COLUMN split_total_minor INTEGER;
ALTER TABLE transactions ADD COLUMN split_share_minor INTEGER;
UPDATE transactions SET split_total_minor=CAST(ROUND(split_total_amount*100) AS INTEGER),split_share_minor=CAST(ROUND(split_my_share*100) AS INTEGER);
ALTER TABLE transactions DROP COLUMN split_total_amount;
ALTER TABLE transactions DROP COLUMN split_my_share;
ALTER TABLE transactions ADD COLUMN voided_at INTEGER;
CREATE TABLE accounts_v3(id TEXT PRIMARY KEY,name TEXT NOT NULL,account_type TEXT NOT NULL CHECK(account_type IN ('BANK_1','BANK_2','BANK','CASH','WALLET')),opening_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(opening_minor)='integer'),color_hex TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1);
INSERT INTO accounts_v3 SELECT a.id,a.name,a.account_type,CAST(ROUND(a.current_balance*100) AS INTEGER)-COALESCE((SELECT SUM(CASE WHEN t.account_id=a.id THEN CASE WHEN t.type='INCOME' THEN t.amount_minor ELSE -t.amount_minor END ELSE t.amount_minor END) FROM transactions t WHERE t.account_id=a.id OR (t.type='TRANSFER' AND t.destination_account_id=a.id)),0),a.color_hex,a.is_active FROM accounts a;
DROP TABLE accounts;
ALTER TABLE accounts_v3 RENAME TO accounts;
ALTER TABLE fixed_commitments ADD COLUMN amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(amount_minor)='integer' AND amount_minor>=0);
UPDATE fixed_commitments SET amount_minor=CAST(ROUND(amount*100) AS INTEGER);
ALTER TABLE fixed_commitments DROP COLUMN amount;
ALTER TABLE categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'EXPENSE' CHECK(kind IN ('EXPENSE','INCOME','BOTH'));
ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
UPDATE categories SET kind='INCOME' WHERE id='salary';
CREATE VIEW ledger AS SELECT *,amount_minor/100.0 AS amount,split_total_minor/100.0 AS split_total_amount,split_share_minor/100.0 AS split_my_share FROM transactions WHERE voided_at IS NULL;
CREATE VIEW account_balances AS SELECT a.*,a.opening_minor+COALESCE((SELECT SUM(CASE WHEN t.account_id=a.id THEN CASE WHEN t.type='INCOME' THEN t.amount_minor ELSE -t.amount_minor END ELSE t.amount_minor END) FROM ledger t WHERE t.account_id=a.id OR (t.type='TRANSFER' AND t.destination_account_id=a.id)),0) AS current_balance_minor,a.opening_minor/100.0 AS starting_balance,(a.opening_minor+COALESCE((SELECT SUM(CASE WHEN t.account_id=a.id THEN CASE WHEN t.type='INCOME' THEN t.amount_minor ELSE -t.amount_minor END ELSE t.amount_minor END) FROM ledger t WHERE t.account_id=a.id OR (t.type='TRANSFER' AND t.destination_account_id=a.id)),0))/100.0 AS current_balance FROM accounts a;
CREATE INDEX idx_ledger_void ON transactions(voided_at,transaction_date);
-- A table rebuild can leave SQLite's deferred deletion counter set even after identical primary keys are restored. Validate all actual references before resetting that counter.
CREATE TEMP TABLE migration_fk_guard(violations INTEGER CHECK(violations=0));
INSERT INTO migration_fk_guard SELECT COUNT(*) FROM pragma_foreign_key_check;
DROP TABLE migration_fk_guard;
PRAGMA defer_foreign_keys=OFF;`,
  `CREATE TABLE salary_rules(id TEXT PRIMARY KEY,title TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor>0),payday INTEGER NOT NULL CHECK(payday BETWEEN 1 AND 31),account_id TEXT NOT NULL REFERENCES accounts(id),category_id TEXT REFERENCES categories(id),start_date TEXT NOT NULL,auto_post INTEGER NOT NULL DEFAULT 0,is_active INTEGER NOT NULL DEFAULT 1,remind_days INTEGER NOT NULL DEFAULT 0);
CREATE TABLE salary_occurrences(rule_id TEXT NOT NULL REFERENCES salary_rules(id),occurrence_date TEXT NOT NULL,transaction_id TEXT REFERENCES transactions(id),PRIMARY KEY(rule_id,occurrence_date));
CREATE TABLE recurring_rules(id TEXT PRIMARY KEY,title TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('INCOME','EXPENSE','TRANSFER')),amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor>0),account_id TEXT NOT NULL REFERENCES accounts(id),destination_account_id TEXT REFERENCES accounts(id),category_id TEXT REFERENCES categories(id),anchor_date TEXT NOT NULL,interval_count INTEGER NOT NULL CHECK(interval_count BETWEEN 1 AND 120),interval_unit TEXT NOT NULL CHECK(interval_unit IN ('DAY','WEEK','MONTH','YEAR')),auto_post INTEGER NOT NULL DEFAULT 0,is_active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE recurring_occurrences(rule_id TEXT NOT NULL REFERENCES recurring_rules(id),occurrence_date TEXT NOT NULL,transaction_id TEXT REFERENCES transactions(id),PRIMARY KEY(rule_id,occurrence_date));
CREATE TABLE loans(id TEXT PRIMARY KEY,title TEXT NOT NULL,principal_minor INTEGER NOT NULL CHECK(typeof(principal_minor)='integer' AND principal_minor>0),annual_rate_bps INTEGER NOT NULL CHECK(annual_rate_bps BETWEEN 0 AND 10000),tenure_months INTEGER NOT NULL CHECK(tenure_months BETWEEN 1 AND 600),emi_minor INTEGER NOT NULL CHECK(typeof(emi_minor)='integer' AND emi_minor>0),first_due_date TEXT NOT NULL,account_id TEXT NOT NULL REFERENCES accounts(id),category_id TEXT REFERENCES categories(id),remind_days INTEGER NOT NULL DEFAULT 3,is_active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE emi_payments(id TEXT PRIMARY KEY,loan_id TEXT NOT NULL REFERENCES loans(id),due_date TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor>0),principal_minor INTEGER NOT NULL CHECK(typeof(principal_minor)='integer' AND principal_minor>=0),interest_minor INTEGER NOT NULL CHECK(typeof(interest_minor)='integer' AND interest_minor>=0),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID')),transaction_id TEXT UNIQUE REFERENCES transactions(id),UNIQUE(loan_id,due_date));
CREATE TABLE subscriptions(id TEXT PRIMARY KEY,title TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor>0),anchor_date TEXT NOT NULL,interval_count INTEGER NOT NULL CHECK(interval_count BETWEEN 1 AND 120),interval_unit TEXT NOT NULL CHECK(interval_unit IN ('DAY','WEEK','MONTH','YEAR')),account_id TEXT NOT NULL REFERENCES accounts(id),category_id TEXT REFERENCES categories(id),remind_days INTEGER NOT NULL DEFAULT 3,is_active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE subscription_payments(subscription_id TEXT NOT NULL REFERENCES subscriptions(id),occurrence_date TEXT NOT NULL,transaction_id TEXT NOT NULL REFERENCES transactions(id),PRIMARY KEY(subscription_id,occurrence_date));
CREATE TABLE budgets(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id),month TEXT NOT NULL,limit_minor INTEGER NOT NULL CHECK(typeof(limit_minor)='integer' AND limit_minor>0),alert_percent INTEGER NOT NULL DEFAULT 100 CHECK(alert_percent BETWEEN 1 AND 100),UNIQUE(category_id,month));
CREATE TABLE budget_alerts(budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,level INTEGER NOT NULL,delivered_at INTEGER,PRIMARY KEY(budget_id,level));
CREATE TABLE savings_goals(id TEXT PRIMARY KEY,title TEXT NOT NULL,target_minor INTEGER NOT NULL CHECK(typeof(target_minor)='integer' AND target_minor>0),deadline TEXT,color_hex TEXT NOT NULL DEFAULT '#00A88A',is_active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE goal_contributions(id TEXT PRIMARY KEY,goal_id TEXT NOT NULL REFERENCES savings_goals(id),account_id TEXT NOT NULL REFERENCES accounts(id),amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor<>0),contribution_date TEXT NOT NULL,note TEXT,transaction_id TEXT UNIQUE REFERENCES transactions(id));
CREATE TABLE reminders(id TEXT PRIMARY KEY,kind TEXT NOT NULL,source_id TEXT NOT NULL,occurrence_date TEXT NOT NULL,title TEXT NOT NULL,amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(amount_minor)='integer'),due_at TEXT NOT NULL,notification_at TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SCHEDULED','DISMISSED')),UNIQUE(kind,source_id,occurrence_date));
CREATE INDEX idx_emi_due ON emi_payments(due_date,status);
CREATE INDEX idx_reminder_due ON reminders(due_at);
CREATE INDEX idx_goals_date ON goal_contributions(contribution_date);
CREATE INDEX idx_salary_date ON salary_occurrences(occurrence_date);
CREATE TABLE work_profiles(id TEXT PRIMARY KEY,is_active INTEGER NOT NULL DEFAULT 1,title TEXT NOT NULL,target_minutes INTEGER NOT NULL CHECK(target_minutes BETWEEN 1 AND 1440),buffer_minutes INTEGER NOT NULL CHECK(buffer_minutes BETWEEN 0 AND 60),tracking_mode TEXT NOT NULL CHECK(tracking_mode IN ('GROSS','NET')),shift_type TEXT NOT NULL CHECK(shift_type IN ('OFFICE','WFH','HALF_DAY','CUSTOM','OPEN_ENDED')),cutoff_minute INTEGER NOT NULL CHECK(cutoff_minute BETWEEN 0 AND 1439),weekdays INTEGER NOT NULL DEFAULT 31 CHECK(weekdays BETWEEN 0 AND 127));`,
  `ALTER TABLE subscriptions ADD COLUMN end_date TEXT;
ALTER TABLE subscriptions ADD COLUMN auto_post INTEGER NOT NULL DEFAULT 0 CHECK(auto_post IN (0,1));
ALTER TABLE subscriptions ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK(payment_type IN ('EXPENSE','TRANSFER'));
ALTER TABLE subscriptions ADD COLUMN destination_account_id TEXT REFERENCES accounts(id);
ALTER TABLE savings_goals ADD COLUMN tracking_basis TEXT NOT NULL DEFAULT 'CONTRIBUTIONS' CHECK(tracking_basis IN ('CONTRIBUTIONS','BALANCE','MONTHLY_SAVINGS'));
ALTER TABLE savings_goals ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE budgets ADD COLUMN reset_at TEXT;
CREATE TABLE lending(id TEXT PRIMARY KEY,title TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor>0),account_id TEXT NOT NULL REFERENCES accounts(id),lent_date TEXT NOT NULL,due_date TEXT,notes TEXT NOT NULL DEFAULT '',transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id));
CREATE TABLE lending_repayments(id TEXT PRIMARY KEY,lending_id TEXT NOT NULL REFERENCES lending(id),amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor>0),account_id TEXT NOT NULL REFERENCES accounts(id),payment_date TEXT NOT NULL,transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id));
CREATE INDEX idx_lending_date ON lending(lent_date);
CREATE INDEX idx_lending_account ON lending(account_id);
CREATE INDEX idx_lending_repayment ON lending_repayments(lending_id,payment_date);
UPDATE app_settings SET value='"OFFICE"' WHERE key='defaultShiftType' AND value IN ('"WFH"','"HALF_DAY"');
UPDATE work_profiles SET shift_type='OFFICE' WHERE shift_type IN ('WFH','HALF_DAY');`,
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
  "salary_rules",
  "salary_occurrences",
  "recurring_rules",
  "recurring_occurrences",
  "loans",
  "emi_payments",
  "subscriptions",
  "subscription_payments",
  "budgets",
  "budget_alerts",
  "savings_goals",
  "goal_contributions",
  "reminders",
  "work_profiles",
  "lending",
  "lending_repayments",
  "schema_metadata",
] as const;
