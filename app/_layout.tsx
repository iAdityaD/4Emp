import React from "react";
import { Stack } from "expo-router";
import App from "../App";
import { useTheme } from "../src/ui/kit";
function Navigation() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
        headerTitle: "",
        contentStyle: { backgroundColor: t.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="quick-entry"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.95, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="transfer"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="contribution"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
export default function RootLayout() {
  return (
    <App>
      <Navigation />
    </App>
  );
}
