import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useTheme } from "../../src/ui/kit";
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.card,
          borderTopColor: t.line,
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      {(
        [
          ["index", "Home", "home-outline"],
          ["transactions", "Activity", "swap-horizontal-outline"],
          ["work", "Work", "time-outline"],
          ["plan", "Plan", "grid-outline"],
          ["more", "Settings", "settings-outline"],
        ] as const
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
