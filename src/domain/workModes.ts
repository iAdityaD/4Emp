import { ShiftType } from "./models";
export const workModes: ShiftType[] = ["OFFICE", "CUSTOM", "OPEN_ENDED"];
export const workModeLabels: Partial<Record<ShiftType, string>> = {
  OFFICE: "Work",
  CUSTOM: "Focus timer",
  OPEN_ENDED: "Stopwatch",
  WFH: "Work",
  HALF_DAY: "Work",
};
export const currentMode = (type: ShiftType): ShiftType =>
  type === "WFH" || type === "HALF_DAY" ? "OFFICE" : type;
export const isFocus = (type: ShiftType) =>
  type === "CUSTOM" || type === "OPEN_ENDED";
