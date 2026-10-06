# 4Emp

A focused native Android companion for your workday. Dark navy surfaces, lime and cyan accents, and four simple tabs: Today, Schedule, History, and Settings.

## Features

- Record swipe in and swipe out with a live elapsed-time display and confirmation before ending a shift.
- Keep attendance locally, including overnight shifts and multiple shifts in a day.
- Correct recorded swipe dates and times; validation prevents future times, reversed times, and overlapping shifts.
- Customize swipe in, swipe out, and timesheet reminders.
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
3. Tap a work time or open **Schedule** to customize reminder times, messages, and repeat days. Defaults are Monday–Friday: 09:00 swipe in, 13:00 lunch, 16:00 tea, 17:30 timesheet, 18:00 swipe out.
4. Use **History → Correct swipe times** to correct a recorded shift.
5. In **Settings**, adjust sound/vibration, send a test notification, or allow precise reminders.

Scheduled reminders do not automatically record swipes or submit timesheets. Timesheet reminders repeat on selected days; there is no employer timesheet integration. Elapsed time includes breaks. Data is private to the app on the device and is removed if you uninstall or clear app data. Backup is disabled.

Android may delay flexible reminders. Precise reminder access is optional. Phone notification channels and Do Not Disturb can override sound/vibration preferences. Force-stopping the app pauses reminders until it is opened again. Reminders use the device’s local timezone and are scheduled individually rather than at fixed 24-hour intervals.

## Validation

```sh
bash tests/run.sh
```

The Java checks cover weekday recurrence, weekend skipping, exact-time boundaries, midnight, timezone changes, DST transitions, invalid schedules, and overnight duration. CI additionally compiles the app and runs Android lint.

Before distributing a release, verify on a physical device: notification permission denial/grant, precise alarm access changes, reboot restoration, sound/vibration settings, screen lock/Doze delivery, manual time edits, process restart persistence, and UI readability with large text.
