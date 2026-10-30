# 4emp · Personal money & work

A local-first Android app built with Expo SDK 53, React Native, Expo Router, strict TypeScript, Zustand, Zod and SQLite. No backend, bank integration, login, telemetry or sample transactions. Existing 4Employee records migrate in place. The original Java app is preserved in `legacy/android`.

## Daily experience

The reference-inspired interface uses warm light surfaces, an OLED dark theme, a teal balance card, clear income/expense colors, SVG charts and a circular shift timer. The five primary tabs are Home, Activity, Work, Plan and Settings. Insights open from the spending chart. Dedicated routes cover account/category editors, transaction corrections, salary and recurring rules, loan details and amortization, subscription renewals, monthly budgets, savings goals and contributions, finance calendar, due-item details, reminder configuration, work profiles, weekly targets, manual logs, break corrections, holiday/calendar reports, security and backup.

Financial screens start with your actual data. Starter accounts/categories and work defaults are editable. Add unlimited bank/cash/wallet accounts, custom category icons/colors, any three-letter currency display code, an accent color, your own work durations and billing schedules. Currency changes do not convert money. Date and clock fields open native pickers. Durations use separate hours/minutes and loan terms use years/months. A touch-driven hue/saturation/value picker and presets customize colors without typing hex codes.

Settings and records are compact summaries. Tap a value to open its focused editor. Creation flows keep each task on its own screen, retain independent nested drafts, and finish with a review before committing. Expense, income and transfer share one numeric entry sheet, with optional details on their own screen. Home includes actual balance trends and category composition; Plan uses budget/goal progress rings. Supporting explanations open from information icons.

## Finance engine

- Transactions support income, expenses, transfers, search, account/type/date filters, edits and reversals. Reversed entries retain an audit record. Balances derive from integer opening paise plus non-voided ledger entries; no independently maintained balance column exists.
- Salary rules support net amount, payday 1–31, account/category, start date, lead-time reminders, pause and optional auto-posting. Recurring income/expense/transfer rules support day/week/month/year intervals.
- Posting catches up **when the app is opened or resumed**; it does not invent background bank transactions. Each rule/date occurrence and its ledger entry commit atomically. Unique database identities prevent duplicates and survive reversing an entry, so reopening cannot recreate deleted salary. Changing a posted schedule requires a new rule; its amount and metadata remain editable.
- Loans use integer principal/interest installments and a reducing-balance schedule. Suggested EMI is available. Final installment rounding preserves principal exactly. Recording a payment debits the selected account once; reversing its ledger entry marks it unpaid. Paid loan terms require a new/refinanced loan to change the amortization assumptions. Loan creation does not imply a bank deposit.
- Subscriptions support arbitrary day/week/month/year intervals, inclusive end dates, payment history, pausing and optional automatic ledger entries. Due occurrences reconcile locally on launch/resume; unique identities prevent duplicate debits. Investment/SIP plans transfer to a user-selected account and stay out of expense analytics. Automatic posting only records locally; it does not initiate payments. Reversed automatic occurrences remain recorded and are never regenerated.
- Lending records manual amounts, people, dates and notes, supports partial/full repayments to any account, and keeps these movements out of personal income/expense analytics. Repayment undo and lending removal reverse their ledger effects atomically, subject to the 24-hour lock.
- Monthly category budgets have editable limits and alert thresholds. Resetting a budget restarts only its spending counter; transaction history remains intact. Personal spending excludes transfers, reconciliation and employer-reimbursable expenses. Alerts are delivered once per threshold/month.
- New savings goals track total or selected-account balances, or current-month net savings, with optional deadlines. Existing/manual contribution goals continue to support reservations and releases. Reserving money is an envelope allocation, not an expense. Optional linked transfers move actual liquidity between accounts. Reversing a linked transfer removes its allocation.
- Safe-to-spend subtracts active goal reservations and unpaid obligations through the configured cycle end, then divides by remaining cycle days. Overdue obligations remain reserved. Transfers and expected future income do not inflate this value. Negative amounts show a shortfall.
- Corporate reimbursement settlement is atomic and idempotent, credits the chosen account, and is excluded from personal income. Split models remain forward-compatible; peer splitting is still explicitly Coming Soon.

Transactions stay in Activity with filtering, category, account and timestamp details. Edit/delete close **exactly 24 hours after the recorded transaction timestamp**, including backdated entries. The repository enforces this even if an editor was opened earlier. Deletion requires confirmation, soft-voids the record and reverses its account effects: expenses return funds, income removes funds, and transfers reverse both sides. Linked plan entries retain their own integrity restrictions. Deleted audit rows are retained in SQLite backups.

## Work engine

Two independent modes keep tracking simple: **Work** records swipe in/out with an editable daily target and optional buffer; **Focus timer** counts down a chosen duration. Both can run simultaneously, with independent pause, completion and notification handling. Stopwatch is retired for new sessions; historical logs remain readable. WFH and half-day are no longer offered for new sessions; existing logs remain readable. Focus sessions deduct pauses, have no office safety buffer or company reset cutoff, and remain usable on leave. Workdays have timestamp-based reset/recovery and optional weekday targets. The existing ring, theme, icons and navigation are preserved.

**Missed swipe in?** opens native date/time controls before starting. The active swipe-in timestamp is also editable. Future times and overlapping sessions are rejected. Targets and remaining time are derived from saved timestamps. Office start/reset, rest-day confirmation, holidays, leave and reminder preferences remain configurable. Saved profiles remain available for existing users through the dedicated route, without filling the simplified settings screen.

## Persistence & privacy

Migrations 1–2 preserve the previous schema. Migration 3 converts existing money to integer paise and derives the required opening balance from existing liquidity and ledger history. It rebuilds the accounts table transactionally, checks all actual foreign keys, and clears SQLite's stale deferred deletion counter before commit. Migration 4 adds planning and work-profile tables, occurrence uniqueness, indexes and relationship constraints. Migration 5 adds lending/repayments, subscription end dates and automatic posting, balance/monthly savings goal tracking, and budget reset timestamps, preserving existing records. Every native exclusive connection enables foreign keys and busy timeout **before** `BEGIN IMMEDIATE` (these pragmas are connection-local).

Repositories, deterministic calculations, scheduling, backup and independent feature screens are separated under `src`. SQLite is the financial source of truth. Amounts exposed in rupees for legacy UI compatibility are read-only SQL view projections; stored money is integer paise.

Portable backups use AES-256-GCM and PBKDF2-SHA256 with a user passphrase. Imports authenticate, validate schema/relationships/settings/integer money, and replace data atomically. Previous-format backups migrate in an isolated temporary SQLite database first. Restores preserve the current device’s lock setting, rather than importing another device’s biometric preference. Device-only encrypted snapshots use a separate random AES key in Expo SecureStore; they do not survive uninstall and are not a substitute for a portable export. CSV is intentionally plaintext. Biometric/device authentication protects UI access, not database-at-rest encryption. Android screenshots are blocked while lock is enabled.

Local alerts require notification permission and Android Alarms & reminders access. Finance/work alerts have separate switches and OS channels. One year of due dates is stored for calendar use. OS requests are bounded to 60: active-shift alarms first, up to 30 finance alerts, then recurring break reminders from a rolling 28-day window. Reopen regularly to replenish the bounded schedule. Force-stop suspends delivery until reopening. Recurrence is not a background bank feed. Native alarms restore on reboot; timezone changes are reconciled on resume. Missed due dates remain visible as overdue.

## Build & validation

```sh
npm ci
npm run check
npx expo install --check
npx expo export --platform android --output-dir dist --max-workers 2
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease lintRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```

Use Node 24, Java 17 and an Android SDK. `npm run check` includes strict TypeScript, real SQLite migration/repository/domain tests and Jest + React Native Testing Library interaction tests. Tests cover old-data migration, integer balances, atomic transfers, reimbursement, recurrence identities, leap/month-end dates, amortization, payment reversal, goal allocation, budget alerts, encrypted backup tampering, atomic restore, work timing and correction boundaries.

GitHub Actions builds a bundled APK, runs Android lint, then installs on an Android 35 emulator and exercises onboarding, a real manually entered expense, primary routes, native time inputs, color selection, focused duration editing, category creation/review and both themes. Compilation/lint and emulator checks run as separate jobs so the UI job can be rerun against the existing APK. Test-harness-only commits do not recompile the app; a UI rerun uses the latest harness only when all app source paths match the built commit. UI screenshots and logs are attached as `android-ui-screenshots`; emulator QA entries are never included in the shipped APK. Download `4Employee-preview-apk` from the workflow artifacts and unzip it.

This remains a development-key preview. A data-preserving in-place upgrade requires the same signing key as the installed app; use your stable signing configuration for production. Physical-device alarm/Doze/reboot and biometric QA, accessibility/large-text review and Play Store signing/release are separate release gates. No Play Store deployment or iOS device verification is claimed.

## Work & Focus update (3.3)

The Work tab opens daily analytics and work schedules directly. Analytics split sessions at local midnight, subtract focus pauses, and report work and focus separately without adding overlapping time. Schedules have editable time, weekdays and workday / leave-and-days-off scope; Settings retains global notification permissions and preferences. Migration 6 allows one active work session and one active focus session and preserves existing logs. The launcher uses a new mint geometric 4 icon; see assets/icon-prompt.md for provenance.
