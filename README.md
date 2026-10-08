# 4Emp

A focused native Android companion for your workday. Dark navy surfaces, lime and cyan accents, and four simple tabs: Today, Schedule, Calendar, and Settings.

## Features

- Record swipe in and swipe out with a live elapsed-time display and confirmation before ending a shift.
- Keep attendance locally, including overnight shifts and multiple shifts in a day.
- Correct recorded swipe dates and times; validation prevents future times, reversed times, and overlapping shifts.
- Set any work duration from 1 minute to 24 hours using hours and minutes. Expected swipe out = actual swipe in + work goal (09:04 + 9 hours = 18:04).
- Minimal Today screen with a live circular progress ring, elapsed hours, work goal, and swipe times. The ring fills clockwise and stays full after the goal; elapsed time keeps counting.
- Configure day start/end in Settings. Swipe-in guidance uses day end minus work goal; swiping remains allowed at any time.
- Swipe-out notifications follow the active shift's calculated target on any day you work. Completed shifts cancel their pending reminder. Duration changes apply to future shifts, with an explicit option to update the active shift too.
- Monthly calendar with worked, leave, holiday, and customizable weekend colors. Worked dates come from recorded shifts, including overnight shifts. Tap a date to mark worked/leave/holiday or clear its manual status.
- On leave today pauses all notifications for that date, removes existing notifications, and skips its scheduled alarms. Holidays also pause reminders. Future dates resume without turning notifications back on.
- Simple Schedule cards with accessible pencil edit icons.
- Customize swipe and timesheet notification messages.
- Add, edit, enable, disable, or delete lunch, tea, and other custom reminders.
- Choose notification messages, times, repeat weekdays, sound, and vibration.
- Restore schedules after reboot, app update, clock changes, and timezone changes.
- Support Android notification permission and optional precise alarm access, with a flexible alarm fallback.
- No login, backend, ads, analytics, internet permission, or employer integration.

## Build

Requires Java 17 and Android SDK 35. Android 8.0 (API 26) or later is supported.

Open the repository in Android Studio and sync Gradle, or configure `ANDROID_HOME` and run:

```sh
./gradlew assembleDebug lintDebug
```

Install `app/build/outputs/apk/debug/app-debug.apk`. For a signed release, configure your own signing key in Android Studio; the CI APK is a development build.

GitHub Actions builds and lints each main-branch push and pull request. Download **4Emp-debug-apk** from a successful [Android build](https://github.com/iAdityaD/4Emp/actions/workflows/android.yml) run. The workflow can also be started manually.

## Use

1. Open **Today** and enable notifications. On Android 13+, approve notification access.
2. Record your actual attendance with **Swipe in** and **Swipe out**. Recording a swipe also sends a confirmation notification when notifications are enabled.
3. Open **Settings** to choose work hours and the start/end of your day. The initial duration/day window is editable, not an enforced company policy. Open **Schedule** for notification messages and recurring breaks. Swipe-in reminders use the latest calculated start on selected weekdays; swipe-out reminders use the active shift's target regardless of weekday. Default recurring breaks/timesheet: Monday–Friday, 13:00 lunch, 16:00 tea, 17:30 timesheet.
4. Use **Calendar** to see attendance, mark leave or holidays, and correct a selected date’s recorded shifts with the edit icon.
5. In **Settings**, adjust sound/vibration, send a test notification, or allow precise reminders.

Scheduled reminders do not automatically record swipes or submit timesheets. Timesheet reminders repeat on selected days; there is no employer timesheet integration. Elapsed time includes breaks. Data is private to the app on the device and is removed if you uninstall or clear app data. Backup is disabled.

Android may delay flexible reminders. Precise reminder access is optional. Phone notification channels and Do Not Disturb can override sound/vibration preferences. Force-stopping the app pauses reminders until it is opened again. Reminders use the device’s local timezone and are scheduled individually rather than at fixed 24-hour intervals.

## Validation

```sh
bash tests/run.sh
```

The Java checks cover weekday recurrence, weekend skipping, exact-time boundaries, midnight, timezone changes, DST transitions, invalid schedules, overnight duration, actual swipe-based finish times, 6/9-hour goals, overnight day windows, clamped ring progress, configurable weekends, overnight calendar dates, and reminders skipping leave/holiday dates. CI additionally compiles the app and runs Android lint.

Before distributing a release, verify on a physical device: notification permission denial/grant, precise alarm access changes, reboot restoration, sound/vibration settings, screen lock/Doze delivery, manual time edits, process restart persistence, and UI readability with large text.
