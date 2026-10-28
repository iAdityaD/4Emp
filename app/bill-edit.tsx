import { useLocalSearchParams } from "expo-router";
import {
  RecordSettingsScreen,
  StartSetup,
} from "../src/features/editor/Screens";
export default function BillEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <RecordSettingsScreen entity="bill" id={id} />
  ) : (
    <StartSetup entity="bill" />
  );
}
