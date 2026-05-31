import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GaugeCardProps {
  label: string;
  value: number | null;
  unit: string;
  color: string;
  decimals?: number;
  warningHigh?: number;
  criticalHigh?: number;
  warningLow?: number;
  compact?: boolean;
}

export function GaugeCard({
  label,
  value,
  unit,
  color,
  decimals = 0,
  warningHigh,
  criticalHigh,
  warningLow,
  compact = false,
}: GaugeCardProps) {
  const colors = useColors();
  const animVal = useRef(new Animated.Value(0)).current;
  const prevValue = useRef<number | null>(null);

  useEffect(() => {
    if (value !== null && value !== prevValue.current) {
      Animated.sequence([
        Animated.timing(animVal, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(animVal, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
      prevValue.current = value;
    }
  }, [value, animVal]);

  const displayValue =
    value === null
      ? "--"
      : decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toString();

  let valueColor = color;
  if (value !== null) {
    if (criticalHigh !== undefined && value >= criticalHigh) {
      valueColor = "#FF4444";
    } else if (warningHigh !== undefined && value >= warningHigh) {
      valueColor = "#FFB800";
    } else if (warningLow !== undefined && value <= warningLow) {
      valueColor = "#FFB800";
    }
  }

  const scale = animVal.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.06, 1],
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, compact && styles.compact]}>
      <View style={[styles.colorBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>
          {label}
        </Text>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Text
            style={[
              styles.value,
              { color: value === null ? colors.mutedForeground : valueColor },
              compact && styles.valueCompact,
            ]}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
        </Animated.View>
        <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    flexDirection: "row",
  },
  compact: {
    minHeight: 72,
  },
  colorBar: {
    width: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    gap: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  valueCompact: {
    fontSize: 22,
  },
  unit: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: -2,
  },
});
