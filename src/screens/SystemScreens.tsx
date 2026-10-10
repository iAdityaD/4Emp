import React, { useState } from "react";
import { Alert, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import {
  Page,
  Card,
  Label,
  Row,
  Button,
  Chips,
  Field,
  Edit,
  act,
} from "../ui/kit";
import { useStore } from "../state/store";
import { useNav } from "../ui/navigation";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { askNotifications } from "../services/notifications";
import { native, exactAccess } from "../services/native";
import { exportBackup, exportCSV, restoreBackup } from "../services/backup";
import { Reminder } from "../domain/models";
import { uid } from "../db/connection";
export function SettingsScreen() {
  const s = useStore(),
    nav = useNav();
  const [cutoff, setCutoff] = useState(
      `${String(Math.floor(s.settings.cutoff / 60)).padStart(2, "0")}:${String(s.settings.cutoff % 60).padStart(2, "0")}`,
    ),
    [cycleDay, setCycle] = useState(String(s.settings.cycleDay)),
    [office, setOffice] = useState(String(s.settings.officeDays));
  return (
    <Page
      title="Make it yours."
      subtitle="Private by design. Everything stays on your device."
    >
      <Card>
        <Label weight>Work configuration</Label>
        <Button
          secondary
          title="Target, tracking mode & buffer"
          onPress={() => nav.navigate("SafeArrival")}
        />
        <Field
          label="Daily reset cutoff (HH:mm, local time)"
          value={cutoff}
          onChange={setCutoff}
        />
        <Field
          label="Weekly office-day target (0–7)"
          value={office}
          onChange={setOffice}
          numeric
        />
        <Button
          title="Save work configuration"
          onPress={() =>
            void act(async () => {
              if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff))
                throw Error("Use HH:mm");
              const [h, m] = cutoff.split(":").map(Number),
                n = Number(office);
              if (!Number.isInteger(n) || n < 0 || n > 7)
                throw Error("Office days must be 0–7");
              await SettingsRepository.save("cutoff", h! * 60 + m!);
              await SettingsRepository.save("officeDays", n);
            })
          }
        />
        <Label muted>Weekend days (calendar only)</Label>
        <Row>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
            <Button
              key={i}
              title={day}
              secondary={!(s.settings.weekends & (1 << i))}
              onPress={() =>
                void s.configure("weekends", s.settings.weekends ^ (1 << i))
              }
            />
          ))}
        </Row>
      </Card>
      <Card>
        <Label weight>Money configuration</Label>
        <Field
          label="Cycle start day (1–31)"
          value={cycleDay}
          onChange={setCycle}
          numeric
        />
        <Button
          title="Save cycle"
          onPress={() =>
            void act(async () => {
              const day = Number(cycleDay);
              if (!Number.isInteger(day) || day < 1 || day > 31)
                throw Error("Choose day 1–31");
              await SettingsRepository.save("cycleDay", day);
            })
          }
        />
        <Chips
          values={["INR", "USD", "EUR", "GBP"]}
          value={s.settings.currency}
          onChange={(v) => void s.configure("currency", v)}
        />
        <Label muted>
          Currency is a display setting; balances are never converted.
        </Label>
      </Card>
      <Card>
        <Label weight>Appearance</Label>
        <Chips
          values={["system", "dark", "light"] as const}
          value={s.settings.theme}
          onChange={(v) => void s.configure("theme", v)}
        />
      </Card>
      <Card>
        <Label weight>Notifications</Label>
        <Button
          secondary
          title={
            s.settings.notifications
              ? "Pause all reminders"
              : "Enable reminders"
          }
          onPress={() =>
            void s.configure("notifications", !s.settings.notifications)
          }
        />
        <Button
          secondary
          title="Request notification permission"
          onPress={() =>
            void act(async () => {
              if (!(await askNotifications()))
                throw Error("Notification permission was not granted");
            })
          }
        />
        <Button
          secondary
          title="Allow precise Android alarms"
          onPress={() => {
            if (native) void native.requestExact();
            else
              Alert.alert(
                "iOS",
                "Local notification timing is managed by iOS.",
              );
          }}
        />
        <Label muted size={12}>
          Without notification and precise-alarm access, shift alerts are
          unavailable. Open the app after force-stop or timezone changes to
          reconcile schedules.
        </Label>
      </Card>
      <Card>
        <Row>
          <Label weight>Break & timesheet reminders</Label>
        </Row>
        <Label muted size={12}>
          Edit the rows below. Add a custom reminder with the button.
        </Label>
        {s.settings.reminders.map((r) => (
          <ReminderForm key={r.id} reminder={r} />
        ))}
        <Button
          secondary
          title="Add custom reminder"
          onPress={() =>
            void s.configure("reminders", [
              ...s.settings.reminders,
              {
                id: uid(),
                title: "Reminder",
                message: "Time for a pause.",
                minute: 840,
                days: 31,
                enabled: true,
              },
            ])
          }
        />
      </Card>
      <Row>
        <Button
          secondary
          title="Biometric lock"
          onPress={() => nav.navigate("Security")}
        />
        <Button
          secondary
          title="Backup & export"
          onPress={() => nav.navigate("Backup")}
        />
      </Row>
    </Page>
  );
}
function ReminderForm({ reminder: r }: { reminder: Reminder }) {
  const s = useStore(),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(r.title),
    [message, setMessage] = useState(r.message),
    [time, setTime] = useState(
      `${String(Math.floor(r.minute / 60)).padStart(2, "0")}:${String(r.minute % 60).padStart(2, "0")}`,
    ),
    [days, setDays] = useState(r.days);
  return (
    <View style={{ gap: 10 }}>
      <Row>
        <Label>
          {r.title} · {r.enabled ? "On" : "Off"}
        </Label>
        <Edit onPress={() => setOpen((v) => !v)} />
      </Row>
      {open && (
        <>
          <Field label="Name" value={title} onChange={setTitle} />
          <Field label="Message" value={message} onChange={setMessage} />
          <Field label="Time (HH:mm)" value={time} onChange={setTime} />
          <Row>
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
              <Button
                key={i}
                secondary={!(days & (1 << i))}
                title={day}
                onPress={() => setDays((v) => v ^ (1 << i))}
              />
            ))}
          </Row>
          <Button
            title="Save reminder"
            onPress={() =>
              void act(
                async () => {
                  if (
                    !title.trim() ||
                    !days ||
                    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
                  )
                    throw Error(
                      "Name, repeat days and valid time are required",
                    );
                  const [h, m] = time.split(":").map(Number);
                  await SettingsRepository.save(
                    "reminders",
                    s.settings.reminders.map((x) =>
                      x.id === r.id
                        ? { ...r, title, message, days, minute: h! * 60 + m! }
                        : x,
                    ),
                  );
                },
                () => setOpen(false),
              )
            }
          />
          <Row>
            <Button
              secondary
              title={r.enabled ? "Disable" : "Enable"}
              onPress={() =>
                void s.configure(
                  "reminders",
                  s.settings.reminders.map((x) =>
                    x.id === r.id ? { ...r, enabled: !r.enabled } : x,
                  ),
                )
              }
            />
            <Button
              secondary
              title="Delete"
              onPress={() =>
                void s.configure(
                  "reminders",
                  s.settings.reminders.filter((x) => x.id !== r.id),
                )
              }
            />
          </Row>
        </>
      )}
    </View>
  );
}
export function SecurityScreen() {
  const s = useStore();
  return (
    <Page
      title="Security lock"
      subtitle="Protect the cockpit when it leaves the foreground."
    >
      <Card>
        <Label size={24}>
          {s.settings.lock ? "Lock enabled" : "Lock disabled"}
        </Label>
        <Label muted>
          Uses your device’s biometrics or enrolled device credentials. Android
          screenshots are blocked while protection is enabled.
        </Label>
        <Button
          title={s.settings.lock ? "Disable lock" : "Enable biometric lock"}
          onPress={() =>
            void act(async () => {
              if (
                !(await LocalAuthentication.hasHardwareAsync()) ||
                !(await LocalAuthentication.isEnrolledAsync())
              )
                throw Error("Enroll biometrics in your phone settings first");
              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: "Confirm 4Employee security",
                disableDeviceFallback: false,
              });
              if (!result.success) throw Error("Authentication canceled");
              await SettingsRepository.save("lock", !s.settings.lock);
            })
          }
        />
      </Card>
    </Page>
  );
}
export function BackupScreen() {
  const s = useStore(),
    [password, setPassword] = useState("");
  return (
    <Page title="Backup & export" subtitle="Your records belong to you.">
      <Card>
        <Field
          label="Backup passphrase (10+ characters)"
          value={password}
          onChange={setPassword}
          secure
        />
        <Label muted size={12}>
          Encrypted JSON uses AES-256-GCM and PBKDF2-SHA256. The passphrase is
          never saved. Keep it somewhere safe; there is no recovery service.
        </Label>
        <Button
          title="Create encrypted backup"
          onPress={() => void act(() => exportBackup(password))}
        />
        <Button
          secondary
          title="Restore encrypted backup"
          onPress={() =>
            Alert.alert(
              "Replace local records?",
              "An authenticated backup replaces the current database atomically. Export a backup first.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Choose backup",
                  onPress: () => void act(() => restoreBackup(password)),
                },
              ],
            )
          }
        />
      </Card>
      <Card>
        <Label weight>CSV exports</Label>
        <Label muted size={12}>
          CSV is unencrypted and can contain private notes. Share it only to
          destinations you trust.
        </Label>
        <Button
          secondary
          title="Export transactions CSV"
          onPress={() => void act(() => exportCSV("transactions"))}
        />
        <Button
          secondary
          title="Export attendance CSV"
          onPress={() => void act(() => exportCSV("work_shifts"))}
        />
      </Card>
    </Page>
  );
}
