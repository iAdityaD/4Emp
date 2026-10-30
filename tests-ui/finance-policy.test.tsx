import React from "react";
import { useFrameCallback } from "react-native-reanimated";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { act, fireEvent, render } from "@testing-library/react-native";
import { TransactionDetailsScreen } from "../src/features/planning/Transactions";
import { FocusedEditScreen } from "../src/features/editor/Screens";
import { HomeScreen } from "../src/screens/WorkScreens";
import { TransactionRepository } from "../src/repositories/TransactionRepository";
import { ShiftRepository } from "../src/repositories/ShiftRepository";
import { useStore } from "../src/state/store";
import { defaultSettings, Transaction } from "../src/domain/models";
import { emptyPlanning } from "../src/features/planning/models";
jest.mock("@react-navigation/native", () => ({ useRoute: jest.fn() }));
const now = new Date(2026, 9, 19, 12).getTime();
function entry(age = 0): Transaction {
  return {
    id: "tx",
    account_id: "a",
    destination_account_id: null,
    type: "EXPENSE",
    amount_minor: 10000,
    amount: 100,
    category_id: null,
    transaction_date: new Date(now - age).toISOString(),
    note: "Lunch",
    is_reimbursable: 0,
    reimbursement_status: "NOT_APPLICABLE",
    is_split: 0,
    split_group_id: null,
    split_total_amount: null,
    split_my_share: null,
    split_notes: null,
    created_at: now,
    ledger_kind: "PERSONAL",
    linked_transaction_id: null,
    tags: "[]",
  };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: "tx" });
  useStore.setState({
    ...emptyPlanning,
    settings: { ...defaultSettings, weekends: 0 },
    shifts: [],
    breaks: [],
    accounts: [],
    categories: [],
    transactions: [entry()],
    marks: [],
    holidays: [],
    alarmWarning: null,
    busy: false,
    mutate: jest.fn(async (fn) => {
      await fn();
      return true;
    }),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it("recent deletion requires confirmation before reversing the balance", async () => {
  const remove = jest
    .spyOn(TransactionRepository, "remove")
    .mockResolvedValue();
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const s = render(<TransactionDetailsScreen />);
  fireEvent.press(s.getByText("Delete entry"));
  expect(remove).not.toHaveBeenCalled();
  expect(alert.mock.calls[0]![0]).toBe("Delete this transaction?");
  expect(alert.mock.calls[0]![1]).toContain("return");
  await act(async () =>
    alert.mock.calls[0]![2]!.find((b) => b.text === "Delete")!.onPress?.(),
  );
  expect(remove).toHaveBeenCalledWith("tx");
});
it("old entries remain visible with no delete action and disabled amount editing", () => {
  useStore.setState({ transactions: [entry(86400000)] });
  const s = render(<TransactionDetailsScreen />);
  expect(s.getByText("Lunch")).toBeTruthy();
  expect(s.queryByText("Delete entry")).toBeNull();
  expect(
    s.getByLabelText("Edit amount").props.accessibilityState.disabled,
  ).toBe(true);
  expect(s.getByText("Locked · 24-hour edit window ended")).toBeTruthy();
});
it("open details lock automatically when the 24-hour window ends", () => {
  useStore.setState({ transactions: [entry(86400000 - 1000)] });
  const s = render(<TransactionDetailsScreen />);
  expect(s.getByText("Delete entry")).toBeTruthy();
  act(() => {
    jest.setSystemTime(now + 1000);
    jest
      .mocked(useFrameCallback)
      .mock.calls.at(
        -1,
      )![0]({ timestamp: 2000, timeSincePreviousFrame: 16, timeSinceFirstFrame: 2000 });
  });
  expect(s.queryByText("Delete entry")).toBeNull();
});
it("a deep link cannot open an expired transaction editor", () => {
  useStore.setState({ transactions: [entry(86400000)] });
  jest.mocked(useLocalSearchParams).mockReturnValue({
    entity: "transaction",
    field: "amount_minor",
    id: "tx",
  });
  const s = render(<FocusedEditScreen />);
  expect(s.getByText("Transaction locked")).toBeTruthy();
  expect(s.queryByText("Save")).toBeNull();
});
it("work exposes only swipe tracking, focus and stopwatch and offers a native missed-time editor", () => {
  const s = render(<HomeScreen />);
  expect(s.queryByRole("button", { name: "WFH" })).toBeNull();
  expect(s.queryByRole("button", { name: "HALF DAY" })).toBeNull();
  expect(s.getByRole("button", { name: "Focus timer" })).toBeTruthy();
  fireEvent.press(s.getByText("Missed swipe in?"));
  expect(s.getByLabelText("Choose Swipe-in time")).toBeTruthy();
  expect(s.getByLabelText("Choose time")).toBeTruthy();
});
it("focus starts even on leave without swipes or a workday reset warning", async () => {
  useStore.setState({
    marks: [{ work_date: "2026-10-19", kind: "LEAVE", note: "" }],
  });
  const start = jest.spyOn(ShiftRepository, "start").mockResolvedValue();
  const s = render(<HomeScreen />);
  fireEvent.press(s.getByRole("button", { name: "Focus timer" }));
  await act(async () => fireEvent.press(s.getByText("Start timer")));
  expect(start).toHaveBeenCalledWith("CUSTOM", 25, expect.any(Object), {
    startedAt: undefined,
  });
  expect(s.queryByText("Swipe in")).toBeNull();
});
