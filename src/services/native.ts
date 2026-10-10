import { NativeModules, Platform } from "react-native";
interface EmployeeNative {
  getLegacy(): Promise<string>;
  cancelLegacy(): Promise<void>;
  canExact(): Promise<boolean>;
  requestExact(): Promise<void>;
  syncCutoffs(json: string): Promise<void>;
  protect(enabled: boolean): void;
}
export const native = NativeModules.EmployeeNative as
  | EmployeeNative
  | undefined;
export const exactAccess = async () =>
  Platform.OS !== "android" || ((await native?.canExact()) ?? false);
