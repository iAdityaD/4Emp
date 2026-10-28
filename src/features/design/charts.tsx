import React from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { Label, useTheme } from "../../ui/kit";
export function Sparkline({
  values,
  color,
  height = 58,
  fill = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const t = useTheme(),
    ink = color ?? t.accent;
  const min = Math.min(0, ...values),
    max = Math.max(...values, min + 1),
    range = max - min;
  const points = values.map((v, i) => [
    8 + (i * 284) / Math.max(1, values.length - 1),
    height - 8 - ((v - min) / range) * (height - 16),
  ]);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <Svg
      accessibilityLabel="Balance trend"
      viewBox={`0 0 300 ${height}`}
      width="100%"
      height={height}
    >
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ink} stopOpacity={0.3} />
          <Stop offset="1" stopColor={ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {fill && points.length > 0 && (
        <Path
          d={`${path} L292,${height} L8,${height}Z`}
          fill="url(#sparkFill)"
        />
      )}
      <Path
        d={path}
        fill="none"
        stroke={ink}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function Donut({
  segments,
  size = 146,
  children,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  children?: React.ReactNode;
}) {
  const t = useTheme(),
    sum = segments.reduce((s, r) => s + r.value, 0),
    r = 54,
    c = 2 * Math.PI * r;
  let start = 0;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        style={{ position: "absolute" }}
        width={size}
        height={size}
        viewBox="0 0 140 140"
      >
        <Circle
          cx={70}
          cy={70}
          r={r}
          stroke={t.line}
          strokeWidth={12}
          fill="none"
        />
        {segments
          .filter((x) => x.value > 0)
          .map((s, i) => {
            const n = s.value / (sum || 1),
              offset = start;
            start += n;
            return (
              <Circle
                key={i}
                cx={70}
                cy={70}
                r={r}
                stroke={s.color}
                strokeWidth={12}
                fill="none"
                strokeDasharray={`${Math.max(0, n * c - 3)} ${c}`}
                strokeDashoffset={-offset * c}
                rotation={-90}
                origin="70,70"
                strokeLinecap="round"
              />
            );
          })}
      </Svg>
      {children}
    </View>
  );
}
export function ProgressOrbit({
  value,
  color,
  children,
  size = 150,
}: {
  value: number;
  color?: string;
  children?: React.ReactNode;
  size?: number;
}) {
  const t = useTheme();
  return (
    <Donut
      size={size}
      segments={[
        { value: Math.max(0, Math.min(1, value)), color: color ?? t.accent },
        { value: Math.max(0, 1 - value), color: t.line },
      ]}
    >
      {children ?? (
        <Label size={24} weight>
          {Math.round(value * 100)}%
        </Label>
      )}
    </Donut>
  );
}
export function WeekBars({
  values,
  labels,
  color,
}: {
  values: number[];
  labels: string[];
  color?: string;
}) {
  const t = useTheme(),
    max = Math.max(1, ...values);
  return (
    <View>
      <Svg width="100%" height={74} viewBox="0 0 280 74">
        {values.map((v, i) => (
          <G key={i}>
            <Rect
              x={i * 40 + 12}
              y={0}
              width={16}
              height={70}
              rx={8}
              fill={t.line}
            />
            {v > 0 && (
              <Rect
                x={i * 40 + 12}
                y={70 - (v / max) * 66}
                width={16}
                height={(v / max) * 66}
                rx={8}
                fill={color ?? t.accent}
              />
            )}
          </G>
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        {labels.map((l, i) => (
          <Label key={i} muted size={10}>
            {l}
          </Label>
        ))}
      </View>
    </View>
  );
}
