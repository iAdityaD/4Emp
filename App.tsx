import React, { useEffect, useRef, useState } from "react";
import { AppState, View, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import { RootStack } from "./src/ui/navigation";
import { useTheme, Loading, Page, Card, Label, Button } from "./src/ui/kit";
import { useStore } from "./src/state/store";
import { initializeDatabase } from "./src/db/database";
import { importLegacy } from "./src/services/legacy";
import { native } from "./src/services/native";
import {
  HomeScreen,
  SafeArrivalScreen,
  ShiftDetailsScreen,
  BreakHistoryScreen,
  CalendarScreen,
  DayDetailsScreen,
  AddHolidayScreen,
  HolidaysScreen,
  ComplianceScreen,
} from "./src/screens/WorkScreens";
import {
  TransactionsScreen,
  QuickEntryScreen,
  TransferScreen,
  AnalyticsScreen,
  ReimbursementsScreen,
  CommitmentsScreen,
  RebalanceScreen,
  SplitScreen,
} from "./src/screens/FinanceScreens";
import {
  SettingsScreen,
  SecurityScreen,
  BackupScreen,
} from "./src/screens/SystemScreens";
const Stack = createNativeStackNavigator<RootStack>();
const Tabs = createBottomTabNavigator();
const ref = createNavigationContainerRef<RootStack>();
function MainTabs() {
  const t = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={
              (
                {
                  Shift: "time-outline",
                  Calendar: "calendar-outline",
                  Ledger: "wallet-outline",
                  Analytics: "pie-chart-outline",
                  Settings: "options-outline",
                } as Record<
                  string,
                  React.ComponentProps<typeof Ionicons>["name"]
                >
              )[route.name]
            }
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen name="Shift" component={HomeScreen} />
      <Tabs.Screen name="Calendar" component={CalendarScreen} />
      <Tabs.Screen name="Ledger" component={TransactionsScreen} />
      <Tabs.Screen name="Analytics" component={AnalyticsScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}
function Cockpit() {
  const s = useStore(),
    t = useTheme();
  const [unlocked, setUnlocked] = useState(false),
    [startupError, setStartupError] = useState<string | null>(null),
    [navigationReady, setReady] = useState(false);
  const prompted = useRef<string | null>(null);
  const initialize = async () => {
    try {
      setStartupError(null);
      await initializeDatabase();
      await importLegacy();
      await useStore.getState().refresh();
      setUnlocked(!useStore.getState().settings.lock);
    } catch (e) {
      setStartupError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    native?.protect(s.settings.lock);
    if (!s.settings.lock) setUnlocked(true);
  }, [s.settings.lock]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active" && useStore.getState().settings.lock)
        setUnlocked(false);
      if (state === "active" && useStore.getState().ready)
        void useStore
          .getState()
          .refresh()
          .catch((e) => setStartupError(String(e)));
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const review = s.shifts.find((x) => x.status === "NEEDS_REVIEW");
    if (
      review &&
      navigationReady &&
      unlocked &&
      prompted.current !== review.id &&
      ref.isReady()
    ) {
      prompted.current = review.id;
      ref.navigate("ShiftDetails", { shiftId: review.id });
    }
  }, [s.shifts, navigationReady, unlocked]);
  if (startupError)
    return (
      <Page title="Could not open your data">
        <Card>
          <Label>{startupError}</Label>
          <Button title="Retry" onPress={() => void initialize()} />
        </Card>
      </Page>
    );
  if (!s.ready) return <Loading />;
  if (s.settings.lock && !unlocked)
    return (
      <Page title="Your private cockpit">
        <Card>
          <Label muted>Unlock to view attendance and finances.</Label>
          <Button
            title="Unlock 4Employee"
            onPress={() =>
              void LocalAuthentication.authenticateAsync({
                promptMessage: "Unlock 4Employee",
                disableDeviceFallback: false,
              }).then((result) => {
                if (result.success) setUnlocked(true);
                else Alert.alert("Locked", "Authentication did not complete.");
              })
            }
          />
        </Card>
      </Page>
    );
  const theme = {
    ...(t.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.dark ? DarkTheme : DefaultTheme).colors,
      background: t.bg,
      card: t.card,
      text: t.text,
      border: t.line,
      primary: t.accent,
    },
  };
  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <NavigationContainer
        ref={ref}
        theme={theme}
        onReady={() => setReady(true)}
      >
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: t.bg },
            headerTintColor: t.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ShiftDetails"
            component={ShiftDetailsScreen}
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.9, 1],
              sheetGrabberVisible: true,
              title: "Shift review",
            }}
          />
          <Stack.Screen
            name="SafeArrival"
            component={SafeArrivalScreen}
            options={{ title: "Arrival calculator" }}
          />
          <Stack.Screen
            name="BreakHistory"
            component={BreakHistoryScreen}
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.9, 1],
              sheetGrabberVisible: true,
              title: "Breaks",
            }}
          />
          <Stack.Screen
            name="DayDetails"
            component={DayDetailsScreen}
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.9, 1],
              sheetGrabberVisible: true,
              title: "Day log",
            }}
          />
          <Stack.Screen
            name="AddHoliday"
            component={AddHolidayScreen}
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.9, 1],
              sheetGrabberVisible: true,
              title: "Holiday",
            }}
          />
          <Stack.Screen
            name="Holidays"
            component={HolidaysScreen}
            options={{ title: "Holiday configuration" }}
          />
          <Stack.Screen
            name="Compliance"
            component={ComplianceScreen}
            options={{ title: "Monthly report" }}
          />
          <Stack.Screen
            name="QuickEntry"
            component={QuickEntryScreen}
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.9, 1],
              sheetGrabberVisible: true,
              title: "New entry",
            }}
          />
          <Stack.Screen
            name="Transfer"
            component={TransferScreen}
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.9, 1],
              sheetGrabberVisible: true,
              title: "Transfer",
            }}
          />
          <Stack.Screen
            name="Reimbursements"
            component={ReimbursementsScreen}
            options={{ title: "Reimbursement ledger" }}
          />
          <Stack.Screen
            name="Commitments"
            component={CommitmentsScreen}
            options={{ title: "EMIs & subscriptions" }}
          />
          <Stack.Screen
            name="Split"
            component={SplitScreen}
            options={{ title: "Split with friends" }}
          />
          <Stack.Screen
            name="Rebalance"
            component={RebalanceScreen}
            options={{ title: "Balances" }}
          />
          <Stack.Screen
            name="Backup"
            component={BackupScreen}
            options={{ title: "Backup & export" }}
          />
          <Stack.Screen
            name="Security"
            component={SecurityScreen}
            options={{ title: "Biometric lock" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Cockpit />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
