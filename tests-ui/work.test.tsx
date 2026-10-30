import * as Notifications from "expo-notifications";
import { dismissWorkNotifications } from "../src/services/notifications";
import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { HomeScreen } from "../src/screens/WorkScreens";
import { WorkProfilesScreen } from "../src/features/planning/WorkSettings";
import { SettingsRepository } from "../src/repositories/SettingsRepository";
import { ShiftRepository } from "../src/repositories/ShiftRepository";
import { useStore } from "../src/state/store";
import { defaultSettings } from "../src/domain/models";
import { emptyPlanning } from "../src/features/planning/models";

jest.mock("@react-navigation/native", () => ({ useRoute: jest.fn() }));
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 19, 9, 4));
  useStore.setState({
    ...emptyPlanning,
    settings: { ...defaultSettings, baseline: 540, weekends: 0 },
    workProfileRevision: 0,
    shifts: [],
    breaks: [],
    marks: [],
    holidays: [],
    busy: false,
    error: null,
    alarmWarning: null,
    mutate: jest.fn(async (action) => {
      await action();
      return true;
    }),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("an applied profile refreshes an idle selection even when its saved defaults have not changed", () => {
  const settings = {
    ...defaultSettings,
    baseline: 420,
    defaultShiftType: "WFH" as const,
    weekends: 0,
  };
  useStore.setState({ settings });
  const s = render(<HomeScreen />);
  fireEvent.press(s.getByRole("button", { name: "Work" }));
  expect(
    s.getByRole("button", { name: "Work" }).props.accessibilityState.selected,
  ).toBe(true);
  act(() => useStore.setState({ workProfileRevision: 1 }));
  expect(
    s.getByRole("button", { name: "Work" }).props.accessibilityState.selected,
  ).toBe(true);
  expect(s.getByText("07:05:00")).toBeTruthy();
});

it("unrelated settings updates preserve a custom target draft", () => {
  const s = render(<HomeScreen />);
  fireEvent.press(s.getByRole("button", { name: "Focus timer" }));
  fireEvent.changeText(s.getByLabelText("Hours"), "3");
  fireEvent.changeText(s.getByLabelText("Minutes"), "15");
  act(() =>
    useStore.setState((state) => ({
      settings: { ...state.settings, accent: "#3B82F6" },
    })),
  );
  expect(s.getByDisplayValue("3")).toBeTruthy();
  expect(s.getByDisplayValue("15")).toBeTruthy();
});

it("rest days keep the ring at zero and require confirmation before a normal shift", async () => {
  useStore.setState((state) => ({
    settings: {
      ...state.settings,
      useWeeklyTargets: true,
      weekTargets: [0, 540, 540, 540, 360, 0, 0],
    },
  }));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const start = jest.spyOn(ShiftRepository, "start").mockResolvedValue();
  const s = render(<HomeScreen />);
  expect(s.getByText("REST DAY")).toBeTruthy();
  expect(s.getByText("00:00:00")).toBeTruthy();
  fireEvent.press(s.getByText("Swipe in"));
  expect(alert).toHaveBeenCalledWith(
    "Work on a rest day?",
    expect.any(String),
    expect.any(Array),
  );
  expect(start).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]![2]!;
  await act(async () => {
    buttons.find((b) => b.text === "Start shift")!.onPress?.();
  });
  expect(start).toHaveBeenCalledWith("OFFICE", 540, expect.any(Object), {
    allowRestDay: true,
    startedAt: undefined,
  });
});

it("late starts use an existing confirmation dialog before writing a shift", async () => {
  jest.setSystemTime(new Date(2026, 9, 19, 20, 0));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const start = jest.spyOn(ShiftRepository, "start").mockResolvedValue();
  const s = render(<HomeScreen />);
  fireEvent.press(s.getByText("Swipe in"));
  expect(start).not.toHaveBeenCalled();
  expect(alert.mock.calls[0]![0]).toBe("Target is after day reset");
  await act(async () => {
    alert.mock.calls[0]![2]!.find(
      (b) => b.text === "Start anyway",
    )!.onPress?.();
  });
  expect(start).toHaveBeenCalledWith("OFFICE", 540, expect.any(Object), {
    allowLateStart: true,
    startedAt: undefined,
  });
});

it("custom rest-day work is explicit and needs no normal-target override", async () => {
  useStore.setState((state) => ({
    settings: {
      ...state.settings,
      useWeeklyTargets: true,
      weekTargets: [0, 540, 540, 540, 360, 0, 0],
    },
  }));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const start = jest.spyOn(ShiftRepository, "start").mockResolvedValue();
  const s = render(<HomeScreen />);
  fireEvent.press(s.getByRole("button", { name: "Focus timer" }));
  fireEvent.changeText(s.getByLabelText("Hours"), "3");
  await act(async () => {
    fireEvent.press(s.getByText("Start timer"));
  });
  expect(alert).not.toHaveBeenCalled();
  expect(start).toHaveBeenCalledWith("CUSTOM", 180, expect.any(Object), {
    startedAt: undefined,
  });
});

it("overnight home targets and leave status use Friday's workday after midnight", () => {
  jest.setSystemTime(new Date(2026, 9, 24, 1, 0));
  useStore.setState((state) => ({
    settings: {
      ...state.settings,
      cutoff: 180,
      useWeeklyTargets: true,
      weekTargets: [540, 540, 540, 540, 360, 0, 0],
    },
    marks: [{ work_date: "2026-10-24", kind: "LEAVE", note: "" }],
  }));
  const s = render(<HomeScreen />);
  expect(s.getByText("06:05:00")).toBeTruthy();
  expect(s.getByText("Swipe in")).toBeTruthy();
  act(() =>
    useStore.setState({
      marks: [{ work_date: "2026-10-23", kind: "LEAVE", note: "" }],
    }),
  );
  expect(s.getByText("Today’s notifications are paused.")).toBeTruthy();
  expect(s.queryByText("Swipe in")).toBeNull();
});

it("applying a profile uses one atomic operation and signals the existing Work screen", async () => {
  const profile = {
    id: "p",
    title: "WFH",
    is_active: 1,
    target_minutes: 420,
    buffer_minutes: 0,
    tracking_mode: "NET" as const,
    shift_type: "WFH" as const,
    cutoff_minute: 1439,
    weekdays: 31,
  };
  useStore.setState({ profiles: [profile] });
  const apply = jest
    .spyOn(SettingsRepository, "applyWorkProfile")
    .mockResolvedValue();
  const save = jest.spyOn(SettingsRepository, "save").mockResolvedValue();
  const s = render(<WorkProfilesScreen />);
  await act(async () => {
    fireEvent.press(s.getByLabelText("Apply WFH"));
  });
  expect(apply).toHaveBeenCalledWith("p");
  expect(save).not.toHaveBeenCalled();
  expect(useStore.getState().workProfileRevision).toBe(1);
});

it("profile changes never rewrite an active shift's displayed target or mode", () => {
  const start = Date.now();
  const cutoff = new Date(2026, 9, 19, 23, 59).toISOString();
  useStore.setState({
    shifts: [
      {
        id: "active",
        work_date: "2026-10-19",
        tracking_mode: "GROSS",
        shift_type: "OFFICE",
        target_minutes: 540,
        buffer_minutes: 5,
        first_swipe_in: new Date(start).toISOString(),
        last_swipe_out: null,
        status: "ACTIVE",
        notes: null,
        created_at: start,
        cutoff_at: cutoff,
      },
    ],
  });
  const s = render(<HomeScreen />);
  act(() =>
    useStore.setState((state) => ({
      settings: {
        ...state.settings,
        baseline: 420,
        mode: "NET",
        defaultShiftType: "WFH",
      },
      workProfileRevision: 1,
    })),
  );
  expect(s.getByText("09:05:00")).toBeTruthy();
  expect(s.getByText("Swipe tracking")).toBeTruthy();
  expect(s.getByText("Work · +5m buffer")).toBeTruthy();
});

it("declaring leave dismisses work notifications without clearing finance alerts", async () => {
  const notification = (identifier: string, id: string, channel?: string) => ({
    request: { identifier, content: { data: { id, channel } } },
  });
  jest
    .mocked(Notifications.getPresentedNotificationsAsync)
    .mockResolvedValue([
      notification("work", "shift-s-target", "work"),
      notification("legacy", "reminder-lunch-2026-10-19"),
      notification("money", "reminder-rent", "finance"),
      notification("budget", "budget-warning", "finance"),
    ] as never);
  await dismissWorkNotifications();
  expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith("work");
  expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith("legacy");
  expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalledWith(
    "money",
  );
  expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalledWith(
    "budget",
  );
});
