# 4Employee

An offline personal cockpit for work attendance and a manual three-wallet ledger. The existing 4Emp repository is now an Expo SDK 53 / React Native TypeScript project. The original native Android app is preserved under `legacy/android`.

## What is implemented

- Five tabs: Shift, Calendar, Ledger, Analytics, and Settings, with dedicated stack/modal routes for every requested sub-flow.
- Gross/net tracking, timestamp-derived countdown/progress, 0/3/5/10-minute buffers, reset cutoffs, safe arrival, office/WFH/half-day/custom/open-ended shifts, break records, manual corrections, and unclosed-shift review.
- Native scheduled T−15, target, and T+60 reminders. Net breaks defer work alerts until the break ends. WFH removes turnstile reminders; open-ended mode has no mandatory target alarm. Android has a native cutoff receiver that persists `NEEDS_REVIEW` independently of JavaScript and restores cutoff alarms after reboot. On all platforms, timestamp-based cutoff reconciliation runs on launch/resume.
- Seven-day calendar logging without weekday restrictions, weekly totals, office-day target, leave marks, optional/mandatory holidays, monthly reports, and day-detail sheets. Weekend markings are configurable. Leave/non-working/mandatory holiday dates mute notifications.
- Independent salary bank, spends bank, and cash accounts; manual income/expense entries; atomic transfers; notes, tags, dates and categories; audited balance correction; reimbursable expenses with idempotent settlement into a chosen account.
- EMI/subscription/rent registry, end-of-month snapping, one payment per cycle, safe daily spend, upcoming obligations, monthly expense donut, and sorted ledger lists.
- Nullable split fields and share-aware repository calculations. **Peer splitting remains the explicitly requested Coming Soon route**; it does not upload contacts or pretend to collect money.
- Adaptive OLED dark/light theme, SVG ring, haptics, Reanimated interactions, bottom sheets, FlashList, biometric lock, Android screenshot protection, authenticated encrypted JSON backups, atomic restore, and formula-safe CSV exports.

No bank login, scraping, server, telemetry, cloud sync, or employer reporting is implemented. Money moves only when you record it. Corporate reimbursements are excluded from personal spending; settlement credits are excluded from personal income. Receivables are not included in liquid balances. Transfers and manual corrections are excluded from expense analytics.

## Run and build

Use Node 24 and Java 17. Android Studio / Android SDK are required for a local Android build.

```sh
npm ci
npm run check
npx expo install --check
npx expo prebuild --platform android --clean
npx expo run:android
```

To create an APK that works without Metro:

```sh
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

GitHub Actions generates the managed project, runs TypeScript/domain/repository checks, builds the bundled Android APK, and runs Android lint. Download **4Employee-preview-apk** from a successful [workflow run](https://github.com/iAdityaD/4Emp/actions/workflows/android.yml). It is an **ARM64 preview build signed with the development key**, not a Play Store production release. A production distribution requires your own stable signing key, device QA, and store configuration. iOS requires macOS/Xcode and has not been device-verified here.

## Data and migrations

`src/db/schema.ts` migration 1 reproduces the requested tables and indexes. Migration 2 adds cutoff snapshots, settlement links/classifications, tags, cycle-payment identities, calendar marks, and an active-session uniqueness constraint. Migrations run transactionally; foreign keys, WAL, and busy timeout are enabled.

Repositories live in `src/repositories`; calculations in `src/domain`; native scheduling/encryption/import services in `src/services`; UI components/screens are separate. Finance calculations use integer minor units in code and round persisted REAL values to two decimals as required by the supplied schema. Changing the currency label does not convert amounts.

The `com.fouremp.app` package ID is preserved. The Android bridge imports existing SharedPreferences shifts, leave/holiday dates, weekend preferences, work targets, and recurring reminders once, within a transaction. **An in-place upgrade must use the same signing key as the installed app.** Installing after an uninstall cannot recover deleted local data. The previous CI debug signing key is not recoverable from the APK.

## Timing and privacy behavior

Shift target, buffer, tracking mode and cutoff are snapshots, so later default-setting edits do not rewrite previous shifts. A shift-detail override changes only that shift. Net mode deducts the actual timestamp duration of breaks. Gross mode does not. UI frame callbacks refresh the display only; all elapsed values derive from persisted timestamps and alarms remain OS-owned.

Notification permission and Android Alarms & reminders access are explicit. If exact access is denied, the UI reports work alerts as unavailable; it does not claim precision. Cutoff locking still has a native fallback and is derived from the saved timestamp. Force-stop suspends delivery until reopening. Generic reminders are scheduled as a rolling 28-day horizon, capped at 60 pending requests for iOS and replenished on launch/resume/edit. Open the app at least once during that horizon to keep recurring reminders populated. Reboot restores Android native scheduled requests. Timezone changes retain active-shift timestamp snapshots; opening the app regenerates local recurring reminder dates.

Biometric lock protects UI access; it does not encrypt the SQLite database at rest. The Android app blocks screenshots when lock is enabled. Backups use AES-256-GCM with random 16-byte salt, 12-byte nonce, and PBKDF2-SHA256 (210,000 iterations). Passwords are not saved and cannot be recovered. Shared export files are removed from app cache after the share sheet returns. CSV is intentionally plaintext and requires a trusted destination.

## Validation and release gate

`npm run check` runs strict TypeScript plus tests against actual SQLite migrations and repository methods (using Node SQLite as the test adapter), shift/money calculations, notification plans, encrypted backup authentication/tampering, and CSV injection handling.

Before calling a distribution production-ready, test on physical Android/iOS devices: reboot/Doze/permission revocation and exact alarm delivery; active net breaks and cutoff recovery; biometrics across background transitions; numpad accessibility and large text; full backup/restore; legacy migration under matching signing; timezone/DST behavior; signing and store compliance. An APK build is not a substitute for this device validation.
