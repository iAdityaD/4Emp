import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Label, useTheme } from "./kit";
export function Ring({
  progress,
  value,
  label,
  sub,
}: {
  progress: number;
  value: string;
  label: string;
  sub: string;
}) {
  const t = useTheme(),
    r = 108,
    c = 2 * Math.PI * r;
  return (
    <View
      style={{ alignItems: "center", justifyContent: "center", height: 264 }}
    >
      <Svg width={264} height={264} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.accent} />
            <Stop offset="1" stopColor={t.cyan} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={132}
          cy={132}
          r={r}
          fill="none"
          stroke={t.line}
          strokeWidth={10}
        />
        <Circle
          cx={132}
          cy={132}
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          rotation={-90}
          origin="132,132"
        />
      </Svg>
      <Label size={12} muted>
        {label}
      </Label>
      <Label size={33} weight>
        {value}
      </Label>
      <Label size={12} color={t.cyan}>
        {sub}
      </Label>
    </View>
  );
}
