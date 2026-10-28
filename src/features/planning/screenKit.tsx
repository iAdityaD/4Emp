import React from "react";
import { Pressable, View } from "react-native";
import { dateKey, localDate } from "../../domain/shift";
import { PlanKind } from "../../repositories/PlanningRepository";
import { Button, Card, Label, Page, Row } from "../../ui/kit";
import { useNav } from "../../ui/navigation";
import { IconButton } from "../design/primitives";
import { Money, Progress } from "./components";
export const monthName = (key: string) =>
  localDate(key + "-01").toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (v: string) => void;
}) {
  const shift = (n: number) => {
    const d = localDate(month + "-01");
    d.setMonth(d.getMonth() + n);
    onChange(dateKey(d).slice(0, 7));
  };
  return (
    <Row>
      <Button title="‹" secondary onPress={() => shift(-1)} />
      <Label weight>{monthName(month)}</Label>
      <Button title="›" secondary onPress={() => shift(1)} />
    </Row>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <Card>
      <Label muted>{text}</Label>
    </Card>
  );
}
export function PlanList({
  kind,
  title,
  description,
  rows,
}: {
  kind: PlanKind;
  title: string;
  description: string;
  rows: {
    id: string;
    title: string;
    subtitle: string;
    amount?: number;
    progress?: number;
    detail?: () => void;
  }[];
}) {
  const nav = useNav();
  return (
    <Page
      title={title}
      trailing={
        <IconButton
          icon="add"
          label={`New ${title.toLowerCase()}`}
          onPress={() => nav.navigate("PlanEdit", { kind })}
        />
      }
    >
      {!rows.length && <Empty text="No records yet" />}
      {rows.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          onPress={
            r.detail ?? (() => nav.navigate("PlanEdit", { kind, id: r.id }))
          }
        >
          <Card>
            <Row>
              <View style={{ flex: 1 }}>
                <Label weight>{r.title}</Label>
                <Label muted size={12}>
                  {r.subtitle}
                </Label>
              </View>
              {r.amount !== undefined && <Money minor={r.amount} />}
            </Row>
            {r.progress !== undefined && <Progress value={r.progress} />}
          </Card>
        </Pressable>
      ))}
    </Page>
  );
}
