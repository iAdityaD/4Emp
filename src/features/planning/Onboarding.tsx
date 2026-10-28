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
import { Button, Card, Label, Page, useTheme } from "../../ui/kit";
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
      <Card>
        <Label weight>Offline & private</Label>
        <Label muted>
          Your records stay on this device. No bank connection and no sign-up.
        </Label>
        <Label weight>Built around you</Label>
        <Label muted>
          Choose your accounts, categories, payday, goals and work hours. Every
          number starts with your own entries.
        </Label>
        <Label weight>Simple daily habits</Label>
        <Label muted>
          Log a purchase, plan a renewal, or swipe into a shift. Back up locally
          whenever you choose.
        </Label>
      </Card>
      <Button
        title="Get started"
        onPress={() => void s.configure("onboarded", true)}
      />
      <Label muted size={11}>
        No subscription or backend is required to use this app.
      </Label>
    </Page>
  );
}
