import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useStore } from "../../state/store";
import { Button, Label, Page, useTheme } from "../../ui/kit";
export function OnboardingScreen() {
  const t = useTheme(),
    s = useStore();
  return (
    <Page title="4emp" subtitle="Track today. Build tomorrow.">
      <View style={{ borderRadius: 26, overflow: "hidden", height: 250 }}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 360 250"
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#062B36" />
              <Stop offset="1" stopColor="#12828A" />
            </LinearGradient>
          </Defs>
          <Rect width={360} height={250} fill="url(#sky)" />
          <Circle cx={265} cy={65} r={30} fill="#F6DCB2" />
          <Path
            d="M0 205 L80 80 L150 170 L210 115 L360 250 L0 250Z"
            fill="#0B4550"
          />
          <Path
            d="M0 250 L110 162 L175 210 L255 140 L360 215 L360 250Z"
            fill="#072E39"
          />
          <Path
            d="M130 250 Q210 200 185 180 Q170 160 220 140"
            fill="none"
            stroke="#00C6A1"
            strokeWidth={4}
          />
        </Svg>
        <View style={{ position: "absolute", left: 24, bottom: 25, gap: 5 }}>
          <Label size={28} weight color="#FFFFFF">
            Your life, in balance.
          </Label>
          <Label color="#C5E3DF">Money and work, on your terms.</Label>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          paddingVertical: 20,
        }}
      >
        {(
          [
            { label: "Offline", icon: "cloud-offline-outline" },
            { label: "Private", icon: "shield-checkmark-outline" },
            { label: "No login", icon: "person-outline" },
          ] as const
        ).map((item) => (
          <View key={item.label} style={{ alignItems: "center", gap: 9 }}>
            <Ionicons name={item.icon} color={t.accent} size={24} />
            <Label muted size={12}>
              {item.label}
            </Label>
          </View>
        ))}
      </View>
      <Button
        title="Get started"
        onPress={() => void s.configure("onboarded", true)}
      />
    </Page>
  );
}
