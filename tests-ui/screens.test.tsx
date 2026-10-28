import { RecordPaymentScreen } from "../src/features/planning/Loans";
import type { Account } from "../src/domain/models";
import { PlanningScreen } from "../src/features/planning/PlanningHub";
import DateTimePicker from "@react-native-community/datetimepicker";
import { fireEvent, render } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { defaultSettings } from "../src/domain/models";
import { ColorPicker, DurationControl } from "../src/features/design/controls";
import { FieldControl } from "../src/features/editor/FieldControl";
import { defaultsFor } from "../src/features/editor/model";
import {
  FocusedEditScreen,
  SetupScreen,
  useCreation,
} from "../src/features/editor/Screens";
import {
  BudgetsScreen,
  FinanceDashboardScreen,
  TransactionDetailsScreen,
} from "../src/features/planning/FinanceScreens";
import { emptyPlanning } from "../src/features/planning/models";
import { WorkSettingsScreen } from "../src/features/planning/WorkSettings";
import { useStore } from "../src/state/store";
const router = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: () => true,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(useRouter).mockReturnValue(router as never);
  useCreation.setState({ drafts: {} });
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
it("dashboard uses real empty balances without demo salary", () => {
  const s = render(<FinanceDashboardScreen />);
  expect(s.getByText("TOTAL BALANCE")).toBeTruthy();
  expect(s.queryByText("₹75,000")).toBeNull();
  expect(s.getByLabelText("Expense")).toBeTruthy();
});
it("durations show hours and minutes and store canonical minutes", () => {
  const change = jest.fn();
  const s = render(<DurationControl value={540} onChange={change} />);
  fireEvent.changeText(s.getByLabelText("Hours"), "6");
  fireEvent.changeText(s.getByLabelText("Minutes"), "30");
  expect(change).toHaveBeenLastCalledWith(390);
  fireEvent.changeText(s.getByLabelText("Minutes"), "65");
  expect(Number.isNaN(change.mock.calls.at(-1)![0])).toBe(true);
});
it("clock values open a native time picker instead of a minute field", () => {
  const change = jest.fn();
  const s = render(
    <FieldControl
      spec={{
        key: "startOfDay",
        label: "Preferred start",
        type: "time",
        icon: "time-outline",
      }}
      value={544}
      onChange={change}
    />,
  );
  expect(s.queryByLabelText("Preferred start")).toBeNull();
  fireEvent.press(s.getByLabelText("Choose time"));
  const picker = s
    .UNSAFE_getAllByType(DateTimePicker)
    .find((p) => p.props.mode === "time")!;
  expect(picker.props.mode).toBe("time");
  const next = new Date();
  next.setHours(9, 4, 0, 0);
  fireEvent(picker, "onChange", { type: "set" }, next);
  expect(change).toHaveBeenCalledWith(544);
});
it("colors have presets and a visual picker, not a hex input", () => {
  const change = jest.fn();
  const s = render(<ColorPicker value="#00A88A" onChange={change} />);
  fireEvent.press(s.getByLabelText("Choose color #3B82F6"));
  expect(change).toHaveBeenCalledWith("#3B82F6");
  expect(s.queryByDisplayValue("#00A88A")).toBeNull();
});
it("settings use focused edit routes with no inline input form", () => {
  const s = render(<WorkSettingsScreen />);
  expect(s.getByText("Daily target")).toBeTruthy();
  expect(s.queryByLabelText("Hours")).toBeNull();
  fireEvent.press(s.getByText("Daily target"));
  expect(router.push).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: "/edit/[entity]/[field]",
      params: expect.objectContaining({ field: "baseline" }),
    }),
  );
});
it("a focused work target uses the duration control", () => {
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ entity: "settings", field: "baseline" });
  const s = render(<FocusedEditScreen />);
  expect(s.getByLabelText("Hours")).toBeTruthy();
  expect(s.getByLabelText("Minutes")).toBeTruthy();
  expect(s.getByText("Save")).toBeTruthy();
});
it("setup saves a step to its own draft without touching nested drafts", () => {
  const base = defaultsFor("category");
  useCreation.getState().put("outer", { entity: "category", data: base });
  useCreation
    .getState()
    .put("nested", { entity: "account", data: defaultsFor("account") });
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ entity: "category", step: "name", draft: "outer" });
  const s = render(<SetupScreen />);
  fireEvent.changeText(s.getByLabelText("Name"), "Pet supplies");
  fireEvent.press(s.getByText("Continue"));
  expect(useCreation.getState().drafts.outer!.data.name).toBe("Pet supplies");
  expect(useCreation.getState().drafts.nested!.entity).toBe("account");
  expect(router.push).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({ step: "kind", draft: "outer" }),
    }),
  );
});
it("review edits return to review rather than replaying the wizard", () => {
  useCreation
    .getState()
    .put("d", { entity: "category", data: defaultsFor("category") });
  jest.mocked(useLocalSearchParams).mockReturnValue({
    entity: "category",
    step: "name",
    draft: "d",
    returnReview: "1",
  });
  const s = render(<SetupScreen />);
  fireEvent.changeText(s.getByLabelText("Name"), "Pets");
  fireEvent.press(s.getByText("Continue"));
  expect(router.back).toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});
it("missing transaction links have a recoverable screen", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: "missing" });
  expect(
    render(<TransactionDetailsScreen />).getByText("Entry unavailable"),
  ).toBeTruthy();
});
it("budgets show an empty state without example limits", () => {
  const s = render(<BudgetsScreen />);
  expect(s.queryByText("₹5,000")).toBeNull();
  expect(s.getByText("No budgets this month")).toBeTruthy();
});

it("Plan exposes monthly bill creation even before a bill exists", () => {
  const s = render(<PlanningScreen />);
  expect(s.getByLabelText("Monthly bills")).toBeTruthy();
});

it("monthly bill payments default to the configured funding account", () => {
  useStore.setState({
    accounts: [
      { id: "a", name: "Primary" },
      { id: "b", name: "Bill bank" },
    ] as Account[],
    commitments: [
      {
        id: "rent",
        title: "Rent",
        amount: 100,
        due_day_of_month: 1,
        account_id: "b",
        commitment_type: "RENT",
        is_active: 1,
      },
    ],
  });
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ kind: "BILL", id: "rent" });
  const s = render(<RecordPaymentScreen />);
  expect(
    s.getByRole("button", { name: "Bill bank" }).props.accessibilityState
      .selected,
  ).toBe(true);
});

it("incomplete signed amounts cannot silently become a zero reconciliation", () => {
  const change = jest.fn();
  const s = render(
    <FieldControl
      spec={{
        key: "balance_minor",
        label: "Balance",
        type: "signedMoney",
        icon: "cash-outline",
      }}
      value={12000}
      onChange={change}
    />,
  );
  fireEvent.changeText(s.getByLabelText("Balance"), "-");
  expect(Number.isNaN(change.mock.calls.at(-1)![0])).toBe(true);
  fireEvent.changeText(s.getByLabelText("Balance"), "-12.50");
  expect(change).toHaveBeenLastCalledWith(-1250);
});

it("focused text fields do not select newly typed characters on focus", () => {
  const change = jest.fn();
  const s = render(
    <FieldControl
      spec={{ key: "name", label: "Name", type: "text", icon: "text-outline" }}
      value=""
      onChange={change}
    />,
  );
  const input = s.getByLabelText("Name");
  expect(input.props.selectTextOnFocus).not.toBe(true);
  expect(input.props.autoCorrect).toBe(false);
  fireEvent.changeText(input, "Q");
  fireEvent.changeText(input, "QA-Pets");
  expect(s.getByDisplayValue("QA-Pets")).toBeTruthy();
});
