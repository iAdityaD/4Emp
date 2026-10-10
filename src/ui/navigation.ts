import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
export type RootStack = {
  Main: undefined;
  ShiftDetails: { shiftId: string };
  SafeArrival: undefined;
  BreakHistory: { shiftId: string };
  DayDetails: { date: string };
  AddHoliday: { date?: string } | undefined;
  Holidays: undefined;
  Compliance: undefined;
  QuickEntry: undefined;
  Transfer: undefined;
  Reimbursements: undefined;
  Commitments: undefined;
  Split: undefined;
  Rebalance: undefined;
  Backup: undefined;
  Security: undefined;
};
export const useNav = () =>
  useNavigation<NativeStackNavigationProp<RootStack>>();
