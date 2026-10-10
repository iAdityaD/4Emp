import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { PlannedAlarm } from "./notificationPlan";
import { exactAccess } from "./native";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function askNotifications() {
  await Notifications.setNotificationChannelAsync("work", {
    name: "Work reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
  });
  return (await Notifications.requestPermissionsAsync()).granted;
}
let serial: Promise<unknown> = Promise.resolve();
export function syncNotifications(plan: PlannedAlarm[]) {
  serial = serial
    .catch(() => {})
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!(await Notifications.getPermissionsAsync()).granted)
        return "Notification permission is off";
      if (Platform.OS === "android" && !(await exactAccess()))
        return "Allow Alarms & reminders in Settings for shift alerts";
      await Notifications.setNotificationChannelAsync("work", {
        name: "Work reminders",
        importance: Notifications.AndroidImportance.HIGH,
      });
      for (const alarm of plan)
        if (alarm.at > Date.now())
          await Notifications.scheduleNotificationAsync({
            identifier: alarm.id,
            content: {
              title: alarm.title,
              body: alarm.body,
              data: { id: alarm.id },
              sound: "default",
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(alarm.at),
              channelId: "work",
            },
          });
      return null;
    });
  return serial as Promise<string | null>;
}
