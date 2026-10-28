import { useLocalSearchParams } from "expo-router";
import React from "react";
import { PlanKind } from "../../repositories/PlanningRepository";
import { RecordSettingsScreen, StartSetup } from "../editor/Screens";
import { planFields } from "../editor/model";
export function PlanEditorScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: PlanKind; id?: string }>();
  const k = Object.hasOwn(planFields, kind) ? kind : "salary";
  return id ? (
    <RecordSettingsScreen entity="plan" id={id} kind={k} />
  ) : (
    <StartSetup entity="plan" kind={k} />
  );
}
