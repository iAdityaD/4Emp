import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "4Employee",
  slug: "4employee",
  version: "2.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#0F1115",
    },
    package: "com.fouremp.app",
    versionCode: 4,
    allowBackup: false,
    permissions: [
      "POST_NOTIFICATIONS",
      "SCHEDULE_EXACT_ALARM",
      "RECEIVE_BOOT_COMPLETED",
      "USE_BIOMETRIC",
    ],
  },
  ios: {
    bundleIdentifier: "com.fouremp.app",
    supportsTablet: true,
    infoPlist: {
      NSFaceIDUsageDescription: "Unlock your private work and finance records.",
    },
  },
  plugins: [
    "expo-asset",
    "expo-font",
    "expo-sqlite",
    "expo-notifications",
    "expo-local-authentication",
    "./plugins/withEmployeeNative",
  ],
};
export default config;
