import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, View } from "react-native";
import { SettingsRepository } from "../../repositories/SettingsRepository";
import {
  exportBackup,
  exportCSV,
  restoreBackup,
  restoreDeviceSnapshot,
  saveDeviceSnapshot,
} from "../../services/backup";
import { native } from "../../services/native";
import { askNotifications } from "../../services/notifications";
import { useStore } from "../../state/store";
import {
  act,
  Button,
  Card,
  Chips,
  Field,
  Label,
  Page,
  Row,
  useTheme,
} from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { Sparkline } from "../design/charts";
import { durationText } from "../design/color";
import { balanceSeries } from "../design/metrics";
import { IconButton, InfoButton, MenuRow, Section } from "../design/primitives";
import { openField, RecordSettingsScreen, StartSetup } from "../editor/Screens";
import { Toggle } from "../planning/components";
export function SettingsHomeScreen() {
  const s = useStore(),
    nav = useNav();
  return (
    <Page title="Settings">
      <Section title="Preferences" />
      <Card>
        <MenuRow
          title="Appearance"
          icon="color-palette-outline"
          value={
            s.settings.theme === "system" ? "System theme" : s.settings.theme
          }
          onPress={() => nav.navigate("Appearance")}
        />
        <MenuRow
          title="Money preferences"
          icon="cash-outline"
          value={s.settings.currency}
          onPress={() => nav.navigate("MoneyPreferences")}
        />
        <MenuRow
          title="Notifications"
          icon="notifications-outline"
          value={s.settings.notifications ? "On" : "Paused"}
          onPress={() => nav.navigate("Notifications")}
        />
      </Card>
      <Section title="Organize" />
      <Card>
        <MenuRow
          title="Accounts"
          icon="wallet-outline"
          value={`${s.accounts.length} active`}
          onPress={() => nav.navigate("Accounts")}
        />
        <MenuRow
          title="Categories"
          icon="pricetags-outline"
          value={`${s.categories.filter((c) => c.is_active).length} active`}
          onPress={() => nav.navigate("Categories")}
        />
      </Card>
      <Section title="Privacy & data" />
      <Card>
        <MenuRow
          title="App lock"
          icon="shield-checkmark-outline"
          value={s.settings.lock ? "Locked" : "Off"}
          onPress={() => nav.navigate("Security")}
        />
        <MenuRow
          title="Backup & export"
          icon="cloud-download-outline"
          onPress={() => nav.navigate("Backup")}
        />
      </Card>
      <View style={{ alignItems: "center", padding: 8 }}>
        <Label muted size={11}>
          4emp · Offline & private
        </Label>
      </View>
    </Page>
  );
}
export function AppearanceScreen() {
  const s = useStore(),
    router = useRouter(),
    t = useTheme(),
    balance = s.accounts.reduce((n, a) => n + a.current_balance_minor, 0);
  return (
    <Page title="Appearance">
      <View
        style={{
          backgroundColor: t.card,
          borderRadius: 24,
          padding: 24,
          gap: 8,
          borderWidth: 1,
          borderColor: t.line,
        }}
      >
        <Row>
          <Ionicons name="sparkles-outline" size={24} color={t.accent} />
          <Label weight>Preview</Label>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: t.accent,
            }}
          />
        </Row>
        <Sparkline
          values={balanceSeries(s.transactions, balance).map((p) => p.value)}
          height={72}
        />
      </View>
      <Card>
        <MenuRow
          title="Theme"
          icon="moon-outline"
          value={s.settings.theme}
          onPress={() => openField(router, "settings", "theme")}
        />
        <MenuRow
          title="Accent color"
          icon="color-palette-outline"
          value={s.settings.accent.toUpperCase()}
          onPress={() => openField(router, "settings", "accent")}
        />
      </Card>
    </Page>
  );
}
export function MoneyPreferencesScreen() {
  const s = useStore(),
    router = useRouter();
  return (
    <Page
      title="Money preferences"
      trailing={
        <InfoButton
          title="Currency"
          text="Currency changes the display label. Existing amounts are not converted."
        />
      }
    >
      <Card>
        <MenuRow
          title="Currency"
          icon="cash-outline"
          value={s.settings.currency}
          onPress={() => openField(router, "settings", "currency")}
        />
        <MenuRow
          title="Cycle starts on"
          icon="calendar-outline"
          value={`Day ${s.settings.cycleDay}`}
          onPress={() => openField(router, "settings", "cycleDay")}
        />
      </Card>
    </Page>
  );
}
export function NotificationsScreen() {
  const s = useStore(),
    router = useRouter();
  return (
    <Page title="Notifications">
      <Card>
        <Toggle
          label="All alerts"
          value={s.settings.notifications}
          onChange={(v) => void s.configure("notifications", v)}
        />
        {s.alarmWarning && (
          <MenuRow
            title="Permission needed"
            icon="alert-circle-outline"
            onPress={() =>
              Alert.alert("Enable reminders", s.alarmWarning!, [
                { text: "Not now", style: "cancel" },
                {
                  text: "Allow notifications",
                  onPress: () =>
                    void act(async () => {
                      await askNotifications();
                    }),
                },
                ...(Platform.OS === "android"
                  ? [
                      {
                        text: "Alarms access",
                        onPress: () => void native?.requestExact(),
                      },
                    ]
                  : []),
              ])
            }
          />
        )}
      </Card>
      <Card>
        <Toggle
          label="Finance alerts"
          value={s.settings.financeNotifications}
          onChange={(v) => void s.configure("financeNotifications", v)}
        />
        <MenuRow
          title="Alert time"
          icon="alarm-outline"
          value={durationText(s.settings.financeReminderMinute)}
          onPress={() => openField(router, "settings", "financeReminderMinute")}
        />
        <Toggle
          label="Focus completion alert"
          value={s.settings.focusNotifications}
          onChange={(v) => void s.configure("focusNotifications", v)}
        />
      </Card>
    </Page>
  );
}
export function WorkReminderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <RecordSettingsScreen entity="reminder" id={id} />
  ) : (
    <StartSetup entity="reminder" />
  );
}
export function SecurityScreen() {
  const s = useStore(),
    t = useTheme();
  return (
    <Page title="App lock">
      <View style={{ alignItems: "center", gap: 20, paddingVertical: 40 }}>
        <View
          style={{
            width: 108,
            height: 108,
            borderRadius: 36,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent + "18",
          }}
        >
          <Ionicons
            name={
              s.settings.lock ? "shield-checkmark-outline" : "shield-outline"
            }
            size={58}
            color={t.accent}
          />
        </View>
        <Label size={24} weight>
          {s.settings.lock ? "Lock enabled" : "Lock is off"}
        </Label>
        <Label muted size={12}>
          Biometrics or device credentials
        </Label>
      </View>
      <Button
        title={s.settings.lock ? "Disable lock" : "Enable lock"}
        icon="finger-print-outline"
        onPress={() =>
          void act(async () => {
            if (
              !(await LocalAuthentication.hasHardwareAsync()) ||
              !(await LocalAuthentication.isEnrolledAsync())
            )
              throw Error("Set up device biometrics first");
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: "Confirm app lock",
              disableDeviceFallback: false,
            });
            if (!result.success) throw Error("Authentication canceled");
            await SettingsRepository.save("lock", !s.settings.lock);
          })
        }
      />
    </Page>
  );
}
export function BackupScreen() {
  const router = useRouter();
  return (
    <Page title="Backup & export">
      <Section title="Portable backup" />
      <Card>
        <MenuRow
          title="Export backup"
          icon="cloud-upload-outline"
          value="Encrypted file"
          onPress={() =>
            router.push({
              pathname: "/backup-action",
              params: { action: "export" },
            })
          }
        />
        <MenuRow
          title="Restore backup"
          icon="cloud-download-outline"
          onPress={() =>
            router.push({
              pathname: "/backup-action",
              params: { action: "restore" },
            })
          }
        />
      </Card>
      <Section title="Data" />
      <Card>
        <MenuRow
          title="Export CSV"
          icon="document-text-outline"
          onPress={() =>
            router.push({
              pathname: "/backup-action",
              params: { action: "csv" },
            })
          }
        />
        <MenuRow
          title="Device snapshots"
          icon="phone-portrait-outline"
          onPress={() =>
            router.push({
              pathname: "/backup-action",
              params: { action: "device" },
            })
          }
        />
      </Card>
    </Page>
  );
}
export function BackupActionScreen() {
  const { action } = useLocalSearchParams<{ action: string }>(),
    [password, setPassword] = useState("");
  const nav = useNav();
  if (action === "csv")
    return (
      <Page
        title="Export CSV"
        trailing={
          <InfoButton
            title="CSV export"
            text="CSV files are unencrypted. Choose a destination you trust."
          />
        }
      >
        <Card>
          <MenuRow
            title="Transactions"
            icon="wallet-outline"
            onPress={() => void act(() => exportCSV("transactions"))}
          />
          <MenuRow
            title="Work logs"
            icon="time-outline"
            onPress={() => void act(() => exportCSV("work_shifts"))}
          />
        </Card>
      </Page>
    );
  if (action === "device")
    return (
      <Page
        title="Device snapshots"
        trailing={
          <InfoButton
            title="Device snapshots"
            text="These stay on this device and do not survive uninstall. Keep a portable backup too."
          />
        }
      >
        <Card>
          <MenuRow
            title="Save snapshot"
            icon="save-outline"
            onPress={() =>
              void act(
                () => saveDeviceSnapshot(),
                () => Alert.alert("Saved"),
              )
            }
          />
          <MenuRow
            title="Restore snapshot"
            icon="refresh-outline"
            onPress={() =>
              Alert.alert(
                "Replace records?",
                "Restore the last snapshot from this device.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Restore",
                    style: "destructive",
                    onPress: () =>
                      void act(
                        () => restoreDeviceSnapshot(),
                        () => nav.goBack(),
                      ),
                  },
                ],
              )
            }
          />
        </Card>
      </Page>
    );
  return (
    <Page
      title={action === "restore" ? "Restore backup" : "Export backup"}
      trailing={
        <InfoButton
          title="Encrypted backup"
          text="Keep this passphrase safe. It is not saved and cannot be recovered. Restores keep the current device’s app lock setting."
        />
      }
    >
      <Field
        label="Passphrase · 10+ characters"
        value={password}
        onChange={setPassword}
        secure
      />
      <Button
        title={action === "restore" ? "Choose backup" : "Export"}
        icon={
          action === "restore" ? "folder-open-outline" : "cloud-upload-outline"
        }
        onPress={() => {
          if (action === "restore")
            Alert.alert(
              "Replace records?",
              "Current records will be replaced. Back up first.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Continue",
                  style: "destructive",
                  onPress: () =>
                    void act(
                      () => restoreBackup(password),
                      () => nav.goBack(),
                    ),
                },
              ],
            );
          else void act(() => exportBackup(password));
        }}
      />
    </Page>
  );
}
