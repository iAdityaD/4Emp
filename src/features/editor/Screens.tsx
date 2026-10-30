import { userMessage } from "../../domain/errors";
import { Ionicons } from "@expo/vector-icons";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { create } from "zustand";
import { uid } from "../../db/connection";
import { AccountRepository } from "../../repositories/AccountRepository";
import { CategoryRepository } from "../../repositories/CategoryRepository";
import { CommitmentRepository } from "../../repositories/CommitmentRepository";
import {
  PlanKind,
  PlanningRepository,
} from "../../repositories/PlanningRepository";
import { SettingsRepository } from "../../repositories/SettingsRepository";
import { ShiftRepository } from "../../repositories/ShiftRepository";
import { useStore } from "../../state/store";
import {
  Button,
  Card,
  Label,
  Loading,
  Page,
  act,
  useTheme,
} from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { Sparkline } from "../design/charts";
import { balanceSeries } from "../design/metrics";
import { IconButton, InfoButton, MenuRow } from "../design/primitives";
import { suggestedEMI } from "../planning/calculations";
import { Money } from "../planning/components";
import { FieldControl } from "./FieldControl";
import {
  Data,
  Entity,
  defaultsFor,
  fieldFor,
  fieldsFor,
  formatField,
  planNames,
  recordFor,
  saveField,
  saveRecord,
  validateValue,
  wizardKeys,
} from "./model";
import { transactionExpired } from "../../domain/transactionPolicy";
interface Draft {
  entity: Entity;
  kind?: PlanKind;
  data: Data;
}
export const useCreation = create<{
  drafts: Record<string, Draft>;
  put: (key: string, draft: Draft) => void;
  clear: (key: string) => void;
}>((set) => ({
  drafts: {},
  put: (key, draft) => set((s) => ({ drafts: { ...s.drafts, [key]: draft } })),
  clear: (key) =>
    set((s) => {
      const drafts = { ...s.drafts };
      delete drafts[key];
      return { drafts };
    }),
}));
const isEntity = (v: string): v is Entity =>
  [
    "lending",
    "repayment",
    "plan",
    "account",
    "category",
    "transaction",
    "settings",
    "reminder",
    "worklog",
    "break",
    "bill",
    "entry",
    "due",
  ].includes(v);
const titleFor = (entity: Entity, kind?: PlanKind) =>
  entity === "lending"
    ? "Lending"
    : entity === "repayment"
      ? "Repayment"
      : entity === "due"
        ? "Personal reminder"
        : entity === "plan" && kind
          ? planNames[kind]
          : entity === "worklog"
            ? "Work log"
            : entity === "reminder"
              ? "Work reminder"
              : entity === "account"
                ? "Account"
                : entity === "category"
                  ? "Category"
                  : "Record";
const destinations: Record<string, string> = {
  lending: "/lending",
  repayment: "/lending",
  salary: "/salary",
  recurring: "/recurring",
  loans: "/loans",
  subscriptions: "/subscriptions",
  budgets: "/budgets",
  goals: "/goals",
  profiles: "/work-profiles",
  account: "/accounts",
  category: "/categories",
  reminder: "/work-schedule",
  worklog: "/work-calendar",
  bill: "/commitments",
  due: "/reminders",
};
export function openField(
  router: ReturnType<typeof useRouter>,
  entity: Entity,
  field: string,
  id?: string,
  kind?: PlanKind,
) {
  router.push({
    pathname: "/edit/[entity]/[field]",
    params: { entity, field, id, kind },
  } as Href);
}
export function StartSetup({
  entity,
  kind,
  initial,
}: {
  entity: Entity;
  kind?: PlanKind;
  initial?: Data;
}) {
  const router = useRouter(),
    started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = uid();
    useCreation.getState().put(token, {
      entity,
      kind,
      data: { ...defaultsFor(entity, kind), ...initial },
    });
    router.dismissTo((destinations[kind ?? entity] ?? "/plan") as Href);
    router.push({
      pathname: "/setup/[entity]/[step]",
      params: {
        entity,
        kind,
        draft: token,
        step: (wizardKeys[kind ?? entity] ?? ["title"])[0],
      },
    } as Href);
  }, []);
  return <Loading />;
}
export function FocusedEditScreen() {
  const p = useLocalSearchParams<{
      entity: string;
      field: string;
      id?: string;
      kind?: PlanKind;
    }>(),
    router = useRouter();
  useStore();
  const entity = isEntity(p.entity) ? p.entity : "settings";
  const spec = fieldFor(entity, p.field, p.kind),
    record = recordFor(entity, p.id, p.kind);
  const [value, setValue] = useState<unknown>(() => {
    const v = record?.[p.field];
    if (spec?.type === "datetime" && !v) return new Date().toISOString();
    return entity === "account" &&
      p.field === "account_type" &&
      String(v).startsWith("BANK")
      ? "BANK"
      : v;
  });
  const [destination, setDestination] = useState(
    String(record?.destination_account_id ?? ""),
  );
  if (
    entity === "transaction" &&
    record &&
    transactionExpired(String(record.transaction_date))
  )
    return (
      <Page title="Transaction locked">
        <Label muted>The 24-hour edit window has ended.</Label>
      </Page>
    );
  if (!spec || !record)
    return (
      <Page title="Unavailable">
        <Label muted>Record not found.</Label>
      </Page>
    );
  return (
    <Page
      title={spec.label}
      trailing={
        entity === "account" && spec.key === "balance_minor" ? (
          <InfoButton
            title="Balance"
            text="Changing the balance creates a reconciliation adjustment. It is excluded from personal income and spending."
          />
        ) : spec.type === "duration" &&
          ["shiftWarningMinutes", "overtimeMinutes"].includes(spec.key) ? (
          <InfoButton
            title={spec.label}
            text="Set 0 hours and 0 minutes to disable this alert."
          />
        ) : spec.key === "mode" || spec.key === "tracking_mode" ? (
          <InfoButton
            title="Tracking mode"
            text="Elapsed time includes breaks. Working time deducts them."
          />
        ) : undefined
      }
    >
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <Ionicons
          name={spec.icon}
          size={38}
          color={useStore.getState().settings.accent}
        />
      </View>
      <FieldControl
        spec={spec}
        value={value}
        onChange={setValue}
        data={{ ...record, __kind: p.kind }}
      />
      {(entity === "transaction" ||
        (entity === "plan" &&
          ["recurring", "subscriptions"].includes(p.kind ?? ""))) &&
        ["type", "payment_type"].includes(spec.key) &&
        value === "TRANSFER" && (
          <FieldControl
            spec={{
              key: "destination_account_id",
              label: "Destination",
              type: "account",
              icon: "arrow-forward-outline",
            }}
            value={destination}
            onChange={(v) => setDestination(String(v))}
          />
        )}
      <Button
        title="Save"
        icon="checkmark"
        onPress={() => {
          if (entity === "entry") {
            void saveField(entity, p.id, spec, value, p.kind)
              .then(() => router.back())
              .catch((e) => Alert.alert("Check value", userMessage(e)));
          } else
            void act(
              () =>
                saveField(
                  entity,
                  p.id,
                  spec,
                  value,
                  p.kind,
                  (entity === "transaction" ||
                    (entity === "plan" &&
                      ["recurring", "subscriptions"].includes(p.kind ?? ""))) &&
                    ["type", "payment_type"].includes(spec.key)
                    ? { destination_account_id: destination }
                    : undefined,
                ),
              () => router.back(),
            );
        }}
      />
    </Page>
  );
}
export function RecordSettingsScreen({
  entity,
  id,
  kind,
}: {
  entity: Entity;
  id: string;
  kind?: PlanKind;
}) {
  const router = useRouter(),
    nav = useNav();
  useStore();
  const record = recordFor(entity, id, kind);
  if (!record)
    return (
      <Page title="Unavailable">
        <Label>No record.</Label>
      </Page>
    );
  const specs = fieldsFor(entity, kind).filter(
    (f) =>
      (f.key !== "destination_account_id" ||
        record.type === "TRANSFER" ||
        record.payment_type === "TRANSFER") &&
      (f.key !== "is_reimbursable" || record.type === "EXPENSE") &&
      !(entity === "worklog" && f.key === "shift_type") &&
      !(
        entity === "lending" &&
        ["amount_minor", "account_id", "lent_date"].includes(f.key)
      ),
  );
  return (
    <Page
      title={String(
        record.title ??
          record.name ??
          record.work_date ??
          titleFor(entity, kind),
      )}
    >
      {entity === "account" && (
        <Card>
          <Money large minor={Number(record.balance_minor)} />
          <Sparkline
            values={balanceSeries(
              useStore
                .getState()
                .transactions.filter(
                  (t) => t.account_id === id || t.destination_account_id === id,
                )
                .map((t) => ({
                  ...t,
                  type:
                    t.type === "TRANSFER"
                      ? t.account_id === id
                        ? "EXPENSE"
                        : "INCOME"
                      : t.type,
                })),
              Number(record.balance_minor),
            ).map((p) => p.value)}
            color={String(record.color_hex)}
          />
        </Card>
      )}
      {entity === "category" && (
        <View style={{ alignItems: "center", padding: 20 }}>
          <View
            style={{
              width: 86,
              height: 86,
              borderRadius: 27,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: String(record.color_hex) + "20",
            }}
          >
            <Ionicons
              name={
                String(record.icon_name) as React.ComponentProps<
                  typeof Ionicons
                >["name"]
              }
              color={String(record.color_hex)}
              size={38}
            />
          </View>
        </View>
      )}
      {entity === "worklog" && record.status === "NEEDS_REVIEW" && (
        <Button
          title="Confirm swipe-out"
          icon="time-outline"
          onPress={() => openField(router, "worklog", "last_swipe_out", id)}
        />
      )}
      <Card>
        {specs.map((spec) => (
          <MenuRow
            key={spec.key}
            title={spec.label}
            value={
              spec.type === "color"
                ? undefined
                : formatField(spec, record[spec.key])
            }
            trailing={
              spec.type === "color" ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    backgroundColor: String(record[spec.key]),
                  }}
                />
              ) : undefined
            }
            icon={spec.icon}
            onPress={() => openField(router, entity, spec.key, id, kind)}
          />
        ))}
      </Card>
      {(entity === "account" || entity === "category") && (
        <Button
          secondary
          icon={record.is_active ? "archive-outline" : "refresh-outline"}
          title={record.is_active ? "Archive" : "Restore"}
          onPress={() => {
            if (!record.is_active) {
              void act(
                () => saveRecord(entity, record, id),
                () => nav.goBack(),
              );
              return;
            }
            Alert.alert(
              "Archive this record?",
              "Existing entries will stay in your activity.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Archive",
                  style: "destructive",
                  onPress: () =>
                    void act(
                      () =>
                        entity === "account"
                          ? AccountRepository.archive(id)
                          : CategoryRepository.archive(id),
                      () => nav.goBack(),
                    ),
                },
              ],
            );
          }}
        />
      )}
      {(entity === "reminder" || entity === "bill") && (
        <Button
          secondary
          title={entity === "bill" ? "Archive" : "Delete reminder"}
          icon="trash-outline"
          onPress={() =>
            Alert.alert(
              entity === "bill" ? "Archive bill?" : "Delete reminder?",
              undefined,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: entity === "bill" ? "Archive" : "Delete",
                  style: "destructive",
                  onPress: () =>
                    void act(
                      () =>
                        entity === "bill"
                          ? CommitmentRepository.remove(id)
                          : SettingsRepository.save(
                              "reminders",
                              useStore
                                .getState()
                                .settings.reminders.filter((r) => r.id !== id),
                            ),
                      () => nav.goBack(),
                    ),
                },
              ],
            )
          }
        />
      )}
      {entity === "break" && (
        <Button
          title="Delete break"
          icon="trash-outline"
          secondary
          onPress={() =>
            Alert.alert("Delete break?", "Work duration will update.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () =>
                  void act(
                    () => ShiftRepository.deleteBreak(id),
                    () => nav.goBack(),
                  ),
              },
            ])
          }
        />
      )}
      {entity === "plan" && kind === "budgets" && (
        <Button
          title="Reset spending counter"
          secondary
          icon="refresh-outline"
          onPress={() =>
            Alert.alert(
              "Reset this budget?",
              "Recorded transactions stay in your history. This budget counts spending from now.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  onPress: () =>
                    void act(
                      () => PlanningRepository.resetBudget(id),
                      () => nav.goBack(),
                    ),
                },
              ],
            )
          }
        />
      )}
      {entity === "plan" && kind && (
        <Button
          secondary
          title={kind === "budgets" ? "Delete budget" : "Archive"}
          icon="archive-outline"
          onPress={() =>
            Alert.alert("Archive?", "Recorded payments are kept.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Archive",
                style: "destructive",
                onPress: () =>
                  void act(
                    () => PlanningRepository.archive(kind, id),
                    () => nav.goBack(),
                  ),
              },
            ])
          }
        />
      )}
    </Page>
  );
}
export function SetupScreen() {
  const p = useLocalSearchParams<{
      entity: string;
      step: string;
      kind?: PlanKind;
      draft: string;
      returnReview?: string;
    }>(),
    router = useRouter(),
    t = useTheme();
  const draft = useCreation((s) => s.drafts[p.draft]);
  const [value, setValue] = useState<unknown>(() => {
    const d = useCreation.getState().drafts[p.draft];
    if (p.step === "emi_minor" && Number(d?.data.emi_minor) === 0) {
      try {
        return suggestedEMI(
          Number(d?.data.principal_minor),
          Number(d?.data.annual_rate_bps),
          Number(d?.data.tenure_months),
        );
      } catch {
        return 0;
      }
    }
    return d?.data[p.step];
  });
  if (!draft || draft.entity !== p.entity)
    return (
      <Page title="Start again">
        <Button title="Go home" onPress={() => router.replace("/")} />
      </Page>
    );
  const keys = [...(wizardKeys[draft.kind ?? draft.entity] ?? ["title"])],
    index =
      ((draft.kind === "recurring" && draft.data.type === "TRANSFER") ||
      (draft.kind === "subscriptions" && draft.data.payment_type === "TRANSFER")
        ? keys.splice(
            keys.indexOf("account_id") + 1,
            0,
            "destination_account_id",
          )
        : 0,
      keys.indexOf(p.step)),
    review = p.step === "review",
    spec = fieldFor(draft.entity, p.step, draft.kind);
  const close = () =>
    Alert.alert("Discard setup?", "This record has not been saved.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          useCreation.getState().clear(p.draft);
          router.dismissTo(
            (destinations[draft.kind ?? draft.entity] ?? "/plan") as Href,
          );
        },
      },
    ]);
  const update = (data: Data) =>
    useCreation.getState().put(p.draft, { ...draft, data });
  return (
    <Page
      title={review ? "Review" : (spec?.label ?? "Setup")}
      subtitle={`${titleFor(draft.entity, draft.kind)} · ${review ? keys.length + 1 : index + 1} of ${keys.length + 1}`}
      trailing={
        <IconButton icon="close" label="Cancel setup" onPress={close} />
      }
    >
      <View style={{ flexDirection: "row", gap: 5 }}>
        {[...keys, "review"].map((k, i) => (
          <View
            key={k}
            style={{
              height: 4,
              borderRadius: 3,
              flex: 1,
              backgroundColor:
                i <= (review ? keys.length : index) ? t.accent : t.line,
            }}
          />
        ))}
      </View>
      {review ? (
        <>
          <Card>
            {keys.map((k) => {
              const f = fieldFor(draft.entity, k, draft.kind);
              return f ? (
                <MenuRow
                  key={k}
                  title={f.label}
                  value={formatField(f, draft.data[k])}
                  icon={f.icon}
                  onPress={() =>
                    router.push({
                      pathname: "/setup/[entity]/[step]",
                      params: {
                        entity: draft.entity,
                        kind: draft.kind,
                        draft: p.draft,
                        step: k,
                        returnReview: "1",
                      },
                    } as Href)
                  }
                />
              ) : null;
            })}
          </Card>
          <Button
            title="Create"
            icon="checkmark"
            onPress={() =>
              void act(
                async () => {
                  for (const k of keys) {
                    const f = fieldFor(draft.entity, k, draft.kind);
                    if (f)
                      validateValue(draft.entity, f, draft.data[k], draft.kind);
                  }
                  await saveRecord(
                    draft.entity,
                    draft.data,
                    undefined,
                    draft.kind,
                  );
                },
                () => {
                  useCreation.getState().clear(p.draft);
                  router.dismissTo(
                    (destinations[draft.kind ?? draft.entity] ??
                      "/plan") as Href,
                  );
                },
              )
            }
          />
        </>
      ) : spec ? (
        <>
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <Ionicons name={spec.icon} size={38} color={t.accent} />
          </View>
          <FieldControl
            key={p.step}
            spec={spec}
            value={value}
            onChange={setValue}
            data={{ ...draft.data, __kind: draft.kind }}
          />
          <Button
            title="Continue"
            icon="arrow-forward"
            onPress={() => {
              try {
                const nextValue = spec.optional && value === "" ? null : value;
                validateValue(draft.entity, spec, nextValue, draft.kind);
                const data = { ...draft.data, [spec.key]: nextValue };
                if (
                  ["type", "payment_type"].includes(spec.key) &&
                  value !== "TRANSFER"
                )
                  data.destination_account_id = null;
                if (
                  spec.key === "interval_unit" &&
                  data.interval_count === undefined
                )
                  data.interval_count = 1;
                update(data);
                p.returnReview
                  ? router.back()
                  : router.push({
                      pathname: "/setup/[entity]/[step]",
                      params: {
                        entity: draft.entity,
                        kind: draft.kind,
                        draft: p.draft,
                        step: keys[index + 1] ?? "review",
                      },
                    } as Href);
              } catch (e) {
                Alert.alert("Check value", userMessage(e));
              }
            }}
          />
        </>
      ) : (
        <Label>Step unavailable</Label>
      )}
    </Page>
  );
}
