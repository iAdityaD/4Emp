import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import {
  FinanceDashboardScreen,
  BudgetsScreen,
  TransactionDetailsScreen,
  CategoryEditScreen,
} from "../src/features/planning/FinanceScreens";
import { PlanEditorScreen } from "../src/features/planning/PlanEditor";
import { WorkSettingsScreen } from "../src/features/planning/WorkSettings";
import { useStore } from "../src/state/store";
import { defaultSettings } from "../src/domain/models";
import { emptyPlanning } from "../src/features/planning/models";
beforeEach(() => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useStore.setState({
    ...emptyPlanning,
    settings: { ...defaultSettings, theme: "light" },
    accounts: [],
    archivedAccounts: [],
    categories: [],
    transactions: [],
    shifts: [],
    breaks: [],
    marks: [],
    holidays: [],
    alarmWarning: null,
    busy: false,
  });
});
it("dashboard shows real empty balances and navigation, with no demo salary", () => {
  const screen = render(<FinanceDashboardScreen />);
  expect(screen.getByText("TOTAL BALANCE")).toBeTruthy();
  expect(
    screen.getByText("Add income to calculate your savings rate."),
  ).toBeTruthy();
  expect(screen.queryByText("₹75,000")).toBeNull();
});
it("category form accepts user names and exposes income/expense classification", () => {
  const screen = render(<CategoryEditScreen />);
  fireEvent.changeText(screen.getByLabelText("Category name"), "Pet supplies");
  expect(screen.getByDisplayValue("Pet supplies")).toBeTruthy();
  expect(screen.getByText("Save category")).toBeTruthy();
  expect(screen.getByText("BOTH")).toBeTruthy();
});
it("salary form includes account selection, custom pay amount and auto-post toggle", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ kind: "salary" });
  const screen = render(<PlanEditorScreen />);
  expect(screen.getByLabelText("Net salary")).toBeTruthy();
  expect(screen.getByLabelText("Automatically record salary")).toBeTruthy();
  expect(screen.getByText("Save")).toBeTruthy();
});
it("work settings exposes seven custom daily targets when enabled", () => {
  useStore.setState({
    settings: { ...defaultSettings, useWeeklyTargets: true },
  });
  const screen = render(<WorkSettingsScreen />);
  expect(
    screen.getByLabelText("Monday mandatory minutes (0 = rest day)"),
  ).toBeTruthy();
  expect(
    screen.getByLabelText("Sunday mandatory minutes (0 = rest day)"),
  ).toBeTruthy();
  expect(
    screen.getByLabelText("Overtime reminder minutes after (0 = off)"),
  ).toBeTruthy();
});
it("budgets have a true empty state rather than fixed example limits", () => {
  const screen = render(<BudgetsScreen />);
  expect(
    screen.getByText(
      "No limits for this month. Choose an expense category and a monthly amount.",
    ),
  ).toBeTruthy();
});
it("deep linked missing transactions render a recoverable unavailable screen", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: "missing" });
  const screen = render(<TransactionDetailsScreen />);
  expect(screen.getByText("Entry unavailable")).toBeTruthy();
});

it("profile editor offers readable weekday buttons and a clock time", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ kind: "profiles" });
  const screen = render(<PlanEditorScreen />);
  expect(screen.getByText("Mon")).toBeTruthy();
  expect(screen.getByText("Sun")).toBeTruthy();
  expect(screen.getByDisplayValue("23:59")).toBeTruthy();
  expect(screen.queryByText("Active weekday mask (Mon=1 … Sun=64)")).toBeNull();
});
