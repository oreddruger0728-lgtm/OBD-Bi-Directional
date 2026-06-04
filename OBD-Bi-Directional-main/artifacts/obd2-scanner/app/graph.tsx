import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Svg, {
  Defs, Line, LinearGradient, Path, Rect, Stop,
  Text as SvgText,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useOBD2 } from "@/contexts/OBD2Context";

// ── Sensor catalog ────────────────────────────────────────────────────────────
type SensorKey =
  | "rpm" | "speed" | "coolantTemp" | "throttle" | "engineLoad"
  | "batteryVoltage" | "maf" | "map" | "stftB1" | "ltftB1"
  | "o2B1S1" | "oilTemp" | "timingAdvance";

interface SensorDef {
  key: SensorKey;
  label: string;
  unit: string;
  color: string;
  softMin: number;
  softMax: number;
  decimals: number;
}

const SENSORS: SensorDef[] = [
  { key: "rpm",            label: "RPM",      unit: "RPM",  color: "#00D4FF", softMin: 0,    softMax: 6000,  decimals: 0 },
  { key: "speed",          label: "Speed",    unit: "km/h", color: "#00E87A", softMin: 0,    softMax: 160,   decimals: 0 },
  { key: "coolantTemp",    label: "Coolant",  unit: "°C",   color: "#FF6B6B", softMin: 40,   softMax: 120,   decimals: 0 },
  { key: "throttle",       label: "Throttle", unit: "%",    color: "#FFB800", softMin: 0,    softMax: 100,   decimals: 1 },
  { key: "engineLoad",     label: "Load",     unit: "%",    color: "#A78BFA", softMin: 0,    softMax: 100,   decimals: 1 },
  { key: "batteryVoltage", label: "Battery",  unit: "V",    color: "#F59E0B", softMin: 10,   softMax: 16,    decimals: 1 },
  { key: "maf",            label: "MAF",      unit: "g/s",  color: "#34D399", softMin: 0,    softMax: 50,    decimals: 2 },
  { key: "map",            label: "MAP",      unit: "kPa",  color: "#60A5FA", softMin: 20,   softMax: 110,   decimals: 0 },
  { key: "stftB1",         label: "STFT B1",  unit: "%",    color: "#E879F9", softMin: -25,  softMax: 25,    decimals: 1 },
  { key: "ltftB1",         label: "LTFT B1",  unit: "%",    color: "#F472B6", softMin: -25,  softMax: 25,    decimals: 1 },
  { key: "o2B1S1",         label: "O2 B1S1",  unit: "V",    color: "#FCD34D", softMin: 0,    softMax: 1.1,   decimals: 3 },
  { key: "oilTemp",        label: "Oil Temp", unit: "°C",   color: "#FB923C", softMin: 40,   softMax: 130,   decimals: 0 },
  { key: "timingAdvance",  label: "Timing",   unit: "°",    color: "#818CF8", softMin: -10,  softMax: 40,    decimals: 1 },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const SAMPLE_INTERVAL_MS = 500;
const WINDOWS = [
  { label: "30s", seconds: 30 },
  { label: "1m",  seconds: 60 },
  { label: "2m",  seconds: 120 },
  { label: "5m",  seconds: 300 },
];
const Y_AXIS_W = 44;
const X_AXIS_H = 22;
const CHART_PADDING_TOP = 10;
const CHART_PADDING_RIGHT = 8;
const GRID_LINES = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────
function niceRange(rawMin: number, rawMax: number, softMin: number, softMax: number) {
  const lo = Math.min(rawMin, softMin);
  const hi = Math.max(rawMax, softMax);
  const pad = (hi - lo) * 0.05;
  return { yMin: lo - pad, yMax: hi + pad };
}

function buildPath(
  points: number[],
  yMin: number,
  yMax: number,
  w: number,
  h: number,
): { linePath: string; fillPath: string } {
  if (points.length < 2) return { linePath: "", fillPath: "" };
  const n = points.length;
  const coords = points.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const ratio = yMax === yMin ? 0.5 : (v - yMin) / (yMax - yMin);
    const y = h - Math.max(0, Math.min(1, ratio)) * h;
    return [x, y] as [number, number];
  });
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L ${coords[n - 1][0].toFixed(1)},${h} L ${coords[0][0].toFixed(1)},${h} Z`;
  return { linePath, fillPath };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GraphScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { liveData, connectionStatus } = useOBD2();

  const [selectedKey, setSelectedKey] = useState<SensorKey>("rpm");
  const [windowIdx, setWindowIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 300, height: 200 });

  // Circular buffer — keyed by sensor
  const buffers = useRef<Record<string, number[]>>({});
  const lastSampleTime = useRef(0);

  const sensor = SENSORS.find((s) => s.key === selectedKey)!;
  const windowSeconds = WINDOWS[windowIdx].seconds;
  const maxPoints = Math.ceil((windowSeconds * 1000) / SAMPLE_INTERVAL_MS) + 1;

  // ── Sampling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (paused) return;
    const now = Date.now();
    if (now - lastSampleTime.current < SAMPLE_INTERVAL_MS - 50) return;
    lastSampleTime.current = now;

    const val = liveData[selectedKey];
    if (val === null || val === undefined) return;

    const buf = buffers.current[selectedKey] ?? [];
    buf.push(val as number);
    if (buf.length > maxPoints) buf.splice(0, buf.length - maxPoints);
    buffers.current[selectedKey] = buf;
  });

  // Reset buffer when sensor or window changes
  useEffect(() => {
    buffers.current[selectedKey] = [];
  }, [selectedKey, windowIdx]);

  // Force re-render every 500ms for live updates
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTick((t) => t + 1), SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const points = buffers.current[selectedKey] ?? [];
  const currentVal = liveData[selectedKey] as number | null;

  const rawMin = points.length ? Math.min(...points) : sensor.softMin;
  const rawMax = points.length ? Math.max(...points) : sensor.softMax;
  const { yMin, yMax } = niceRange(rawMin, rawMax, sensor.softMin, sensor.softMax);
  const avg = points.length ? points.reduce((a, b) => a + b, 0) / points.length : null;

  const chartW = Math.max(10, chartSize.width - Y_AXIS_W - CHART_PADDING_RIGHT);
  const chartH = Math.max(10, chartSize.height - X_AXIS_H - CHART_PADDING_TOP);

  const { linePath, fillPath } = buildPath(points, yMin, yMax, chartW, chartH);

  const yLabels = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const frac = i / GRID_LINES;
    const v = yMin + frac * (yMax - yMin);
    return { y: chartH - frac * chartH, value: v };
  });

  const fmt = (v: number | null) =>
    v === null || v === undefined
      ? "--"
      : v.toFixed(sensor.decimals);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerDot, { backgroundColor: sensor.color }]} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{sensor.label}</Text>
          <Text style={[styles.headerUnit, { color: colors.mutedForeground }]}>{sensor.unit}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setPaused((p) => !p)}
          style={[styles.pauseBtn, { backgroundColor: paused ? "#FFB80020" : colors.secondary, borderColor: paused ? "#FFB800" : colors.border }]}
        >
          <Feather name={paused ? "play" : "pause"} size={14} color={paused ? "#FFB800" : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Sensor selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sensorRow}>
        {SENSORS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.sensorChip,
              {
                backgroundColor: selectedKey === s.key ? s.color + "25" : colors.card,
                borderColor: selectedKey === s.key ? s.color : colors.border,
              },
            ]}
            onPress={() => setSelectedKey(s.key)}
          >
            <View style={[styles.sensorDot, { backgroundColor: s.color, opacity: selectedKey === s.key ? 1 : 0.4 }]} />
            <Text style={[styles.sensorChipText, { color: selectedKey === s.key ? s.color : colors.mutedForeground }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart area */}
      <View
        style={styles.chartContainer}
        onLayout={(e) =>
          setChartSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
      >
        {points.length < 2 ? (
          <View style={styles.emptyChart}>
            <Feather name="activity" size={32} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {connectionStatus === "CONNECTED"
                ? "Collecting data…"
                : "Connect to start graphing"}
            </Text>
          </View>
        ) : (
          <Svg
            width={chartSize.width}
            height={chartSize.height}
            style={{ position: "absolute", left: 0, top: 0 }}
          >
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={sensor.color} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={sensor.color} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* Y-axis grid lines + labels */}
            {yLabels.map(({ y, value }, i) => (
              <React.Fragment key={i}>
                <Line
                  x1={Y_AXIS_W}
                  y1={y + CHART_PADDING_TOP}
                  x2={chartSize.width - CHART_PADDING_RIGHT}
                  y2={y + CHART_PADDING_TOP}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray={i > 0 ? "3 4" : undefined}
                />
                <SvgText
                  x={Y_AXIS_W - 4}
                  y={y + CHART_PADDING_TOP + 4}
                  textAnchor="end"
                  fontSize="9"
                  fill={colors.mutedForeground}
                  fontFamily="Inter_400Regular"
                >
                  {value.toFixed(sensor.decimals)}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Zero line if range crosses 0 */}
            {yMin < 0 && yMax > 0 && (() => {
              const zeroY = chartH - ((0 - yMin) / (yMax - yMin)) * chartH + CHART_PADDING_TOP;
              return (
                <Line
                  x1={Y_AXIS_W} y1={zeroY}
                  x2={chartSize.width - CHART_PADDING_RIGHT} y2={zeroY}
                  stroke="#FFFFFF20" strokeWidth="1.5"
                />
              );
            })()}

            {/* Fill area */}
            <Path
              d={fillPath}
              fill="url(#fill)"
              transform={`translate(${Y_AXIS_W}, ${CHART_PADDING_TOP})`}
            />

            {/* Line */}
            <Path
              d={linePath}
              fill="none"
              stroke={sensor.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(${Y_AXIS_W}, ${CHART_PADDING_TOP})`}
            />

            {/* Current value dot */}
            {points.length > 0 && (() => {
              const lastVal = points[points.length - 1];
              const dotX = chartSize.width - CHART_PADDING_RIGHT;
              const ratio = yMax === yMin ? 0.5 : (lastVal - yMin) / (yMax - yMin);
              const dotY = chartH - Math.max(0, Math.min(1, ratio)) * chartH + CHART_PADDING_TOP;
              return (
                <>
                  <Rect x={dotX - 1} y={CHART_PADDING_TOP} width={2} height={chartH} fill={sensor.color} opacity={0.3} />
                  <Path
                    d={`M ${dotX} ${dotY} m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0`}
                    fill={sensor.color}
                    stroke={colors.background}
                    strokeWidth="2"
                  />
                </>
              );
            })()}

            {/* X-axis time labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const secsAgo = Math.round((1 - frac) * windowSeconds);
              const x = Y_AXIS_W + frac * chartW;
              return (
                <SvgText
                  key={frac}
                  x={x}
                  y={chartH + CHART_PADDING_TOP + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill={colors.mutedForeground}
                  fontFamily="Inter_400Regular"
                >
                  {secsAgo === 0 ? "now" : `-${secsAgo}s`}
                </SvgText>
              );
            })}
          </Svg>
        )}
      </View>

      {/* Window selector */}
      <View style={[styles.windowRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Text style={[styles.windowLabel, { color: colors.mutedForeground }]}>WINDOW</Text>
        {WINDOWS.map((w, i) => (
          <TouchableOpacity
            key={w.label}
            style={[styles.windowBtn, { backgroundColor: windowIdx === i ? sensor.color + "20" : colors.secondary, borderColor: windowIdx === i ? sensor.color : colors.border }]}
            onPress={() => setWindowIdx(i)}
          >
            <Text style={[styles.windowBtnText, { color: windowIdx === i ? sensor.color : colors.mutedForeground }]}>{w.label}</Text>
          </TouchableOpacity>
        ))}

        {paused && (
          <View style={[styles.pausedBadge, { backgroundColor: "#FFB80018", borderColor: "#FFB800" }]}>
            <Feather name="pause-circle" size={10} color="#FFB800" />
            <Text style={styles.pausedText}>PAUSED</Text>
          </View>
        )}
      </View>

      {/* Stats bar */}
      <View style={[styles.statsRow, { borderTopColor: colors.border, paddingBottom: insets.bottom + 90 }]}>
        {[
          { label: "NOW", value: fmt(currentVal) },
          { label: "MIN", value: points.length ? fmt(rawMin) : "--" },
          { label: "MAX", value: points.length ? fmt(rawMax) : "--" },
          { label: "AVG", value: avg !== null ? fmt(avg) : "--" },
          { label: "SAMPLES", value: points.length.toString() },
        ].map(({ label, value }) => (
          <View key={label} style={styles.statCell}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <Text style={[styles.statValue, { color: label === "NOW" ? sensor.color : colors.foreground }]}>{value}</Text>
            {label === "NOW" && (
              <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>{sensor.unit}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1,
  },
  backBtn: { padding: 2 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1, justifyContent: "center" },
  headerDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pauseBtn: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  sensorRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  sensorChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  sensorDot: { width: 6, height: 6, borderRadius: 3 },
  sensorChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chartContainer: { flex: 1, marginHorizontal: 0 },
  emptyChart: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  windowRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1,
  },
  windowLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  windowBtn: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 5 },
  windowBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pausedBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: "auto" },
  pausedText: { color: "#FFB800", fontSize: 9, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row", borderTopWidth: 1,
    paddingHorizontal: 8, paddingTop: 10,
  },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statUnit: { fontSize: 9, fontFamily: "Inter_400Regular" },
});
