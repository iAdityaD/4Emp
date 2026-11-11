import { useRouter } from "expo-router";
import React from "react";
import { useStore } from "../../state/store";
import { Card, Page } from "../../ui/kit";
import { InfoButton, MenuRow, Section } from "../design/primitives";
import { openField } from "../editor/Screens";
import { Toggle } from "../planning/components";
import { ruleGroups, rules, ruleText } from "./registry";
/** Generated entirely from the rules registry: new rules appear here on their own. */
export function RulesScreen() {
  const s = useStore(),
    router = useRouter();
  return (
    <Page
      title="Rules"
      trailing={
        <InfoButton
          title="Your rules"
          text="These rules decide how 4emp behaves for you. Changing a rule never deletes records: a hidden section keeps its data and returns when you switch it back on."
        />
      }
    >
      {ruleGroups.map((group) => (
        <React.Fragment key={group.id}>
          <Section title={group.title} />
          <Card>
            {rules
              .filter((rule) => rule.group === group.id)
              .map((rule) =>
                rule.type === "toggle" ? (
                  <Toggle
                    key={rule.key}
                    label={rule.label}
                    description={rule.description}
                    value={!!s.settings[rule.key]}
                    onChange={(v) => void s.configure(rule.key, v)}
                  />
                ) : (
                  <MenuRow
                    key={rule.key}
                    title={rule.label}
                    icon={rule.icon}
                    value={`${ruleText(rule, s.settings[rule.key])} · ${rule.description}`}
                    onPress={() => openField(router, "settings", rule.key)}
                  />
                ),
              )}
          </Card>
        </React.Fragment>
      ))}
    </Page>
  );
}
