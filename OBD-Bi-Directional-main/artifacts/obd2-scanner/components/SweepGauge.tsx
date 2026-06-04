import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface SweepGaugeProps {
  label: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
  color: string;
  size?: number;
  warningHigh?: number;
  criticalHigh?: number;
  ticks?: number[];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function SweepGauge({
  label,
  value,
  unit,
  min,
  max,
  color,
  size = 200,
  warningHigh,
  criticalHigh,
  ticks = [],
}: SweepGaugeProps) {
  const colors = useColors();
  const animatedAngle = useRef(new Animated.Value(-135)).current;

  const START_ANGLE = -135;
  const END_ANGLE = 135;
  const TOTAL_SWEEP = 270;

  const normalized = value !== null ? Math.max(min, Math.min(max, value)) : min;
  const ratio = (normalized - min) / (max - min);
  const targetAngle = START_ANGLE + ratio * TOTAL_SWEEP;

  useEffect(() => {
    Animated.spring(animatedAngle, {
      toValue: value !== null ? targetAngle : START_ANGLE,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [targetAngle, value, animatedAngle]);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeW = size * 0.055;

  let displayColor = color;
  if (value !== null) {
    if (criticalHigh !== undefined && value >= criticalHigh) displayColor = "#FF4444";
    else if (warningHigh !== undefined && value >= warningHigh) displayColor = "#FFB800";
  }

  const arcBg = describeArc(cx, cy, r, START_ANGLE, END_ANGLE);
  const arcFill = value !== null ? describeArc(cx, cy, r, START_ANGLE, targetAngle) : "";

  const displayValue = value === null ? "--" : Math.round(value).toString();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, width: size + 16, borderRadius: 16 }]}>
      <Svg width={size} height={size * 0.85}>
        <Path
          d={arcBg}
          stroke={colors.border}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
        />
        {value !== null && arcFill ? (
          <Path
            d={arcFill}
            stroke={displayColor}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {ticks.map((tick) => {
          const tickRatio = (tick - min) / (max - min);
          const tickAngle = START_ANGLE + tickRatio * TOTAL_SWEEP;
          const inner = polarToCartesian(cx, cy, r - strokeW, tickAngle);
          const outer = polarToCartesian(cx, cy, r + 6, tickAngle);
          return (
            <React.Fragment key={tick}>
              <Path
                d={`M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`}
                stroke={colors.mutedForeground}
                strokeWidth={1.5}
                opacity={0.5}
              />
            </React.Fragment>
          );
        })}
        <Circle cx={cx} cy={cy} r={r * 0.32} fill={colors.background} />
        <SvgText
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize={size * 0.13}
          fontWeight="700"
          fill={value === null ? colors.mutedForeground : displayColor}
        >
          {displayValue}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + size * 0.1}
          textAnchor="middle"
          fontSize={size * 0.065}
          fill={colors.mutedForeground}
        >
          {unit}
        </SvgText>
      </Svg>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderWidth: 1,
    paddingTop: 8,
    paddingBottom: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: -4,
    marginBottom: 4,
  },
});
