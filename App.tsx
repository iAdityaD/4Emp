import { OnboardingScreen } from "./src/features/planning/Onboarding";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { useRouter, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme, Loading, Page, Card, Label, Button } from "./src/ui/kit";
import { useStore } from "./src/state/store";
import { initializeDatabase } from "./src/db/database";
import { importLegacy } from "./src/services/legacy";
import { native } from "./src/services/native";
function Runtime({ children }: { children: React.ReactNode }) {
  const s = useStore(),
    t = useTheme(),
    router = useRouter(),
    navigation = useRootNavigationState();
  const [unlocked, setUnlocked] = useState(false),
    [error, setError] = useState<string | null>(null),
    [booting, setBooting] = useState(true);
  const prompted = useRef<string | null>(null);
  const initialize = async () => {
    try {
      setError(null);
      setBooting(true);
      await initializeDatabase();
      await importLegacy();
      await useStore.getState().refresh();
      setUnlocked(!useStore.getState().settings.lock);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBooting(false);
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
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && useStore.getState().settings.lock)
        setUnlocked(false);
      if (state === "active" && useStore.getState().ready)
        void useStore
          .getState()
          .refresh()
          .catch((e) => setError(String(e)));
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const review = s.shifts.find((x) => x.status === "NEEDS_REVIEW");
    if (
      !booting &&
      unlocked &&
      navigation?.key &&
      review &&
      prompted.current !== review.id
    ) {
      prompted.current = review.id;
      router.push({
        pathname: "/shift-details",
        params: { shiftId: review.id },
      });
    }
  }, [s.shifts, booting, unlocked, navigation?.key]);
  if (error)
    return (
      <Page title="Could not open your data">
        <Card>
          <Label>{error}</Label>
          <Button title="Retry" onPress={() => void initialize()} />
        </Card>
      </Page>
    );
  if (booting || !s.ready) return <Loading />;
  if (s.settings.lock && !unlocked)
    return (
      <Page title="Your private cockpit">
        <Card>
          <Label muted>Unlock to access your money and work records.</Label>
          <Button
            title="Unlock 4emp"
            onPress={() =>
              void LocalAuthentication.authenticateAsync({
                promptMessage: "Unlock 4emp",
                disableDeviceFallback: false,
              }).then((r) => {
                if (r.success) setUnlocked(true);
                else Alert.alert("Locked", "Authentication did not complete.");
              })
            }
          />
        </Card>
      </Page>
    );
  if (!s.settings.onboarded) return <OnboardingScreen />;
  const base = t.dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: t.bg,
          card: t.card,
          text: t.text,
          border: t.line,
          primary: t.accent,
        },
      }}
    >
      <StatusBar style={t.dark ? "light" : "dark"} />
      {children}
    </ThemeProvider>
  );
}
export default function App({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Runtime>{children}</Runtime>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
