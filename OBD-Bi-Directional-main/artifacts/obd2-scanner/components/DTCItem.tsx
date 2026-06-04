import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { type DTCEntry } from "@/utils/dtcDatabase";
import { type FreezeFrameData } from "@/contexts/OBD2Context";

interface DTCItemProps {
  entry: DTCEntry;
  freezeFrame?: FreezeFrameData | null;
  isFetchingFreezeFrame?: boolean;
  onFetchFreezeFrame?: () => void;
}

const SEVERITY_COLORS: Record<DTCEntry["severity"], string> = {
  critical: "#FF4444",
  warning: "#FFB800",
  info: "#00D4FF",
};
const SEVERITY_ICONS: Record<DTCEntry["severity"], keyof typeof Feather.glyphMap> = {
  critical: "alert-circle",
  warning: "alert-triangle",
  info: "info",
};
const SYSTEM_LABELS: Record<DTCEntry["system"], string> = {
  powertrain: "POWERTRAIN", body: "BODY", chassis: "CHASSIS", network: "NETWORK",
};
const SYSTEM_COLORS: Record<DTCEntry["system"], string> = {
  powertrain: "#00D4FF", body: "#A78BFA", chassis: "#FB923C", network: "#F472B6",
};

// Ordered sensor cells for freeze frame grid
const FREEZE_CELLS = [
  { key: "rpm",          label: "RPM",          unit: "rpm",  color: "#00D4FF" },
  { key: "speed",        label: "SPEED",         unit: "km/h", color: "#00E87A" },
  { key: "coolantTemp",  label: "COOLANT",       unit: "°C",   color: "#FF6B6B" },
  { key: "throttle",     label: "THROTTLE",      unit: "%",    color: "#00D4FF" },
  { key: "engineLoad",   label: "ENGINE LOAD",   unit: "%",    color: "#FFB800" },
  { key: "map",          label: "MAP",           unit: "kPa",  color: "#A78BFA" },
  { key: "maf",          label: "MAF",           unit: "g/s",  color: "#A78BFA" },
  { key: "timingAdvance",label: "TIMING",        unit: "°",    color: "#00E87A" },
  { key: "intakeTemp",   label: "INTAKE TEMP",   unit: "°C",   color: "#FB923C" },
  { key: "stftB1",       label: "STFT B1",       unit: "%",    color: "#FFB800" },
  { key: "ltftB1",       label: "LTFT B1",       unit: "%",    color: "#FFB800" },
  { key: "o2B1S1",       label: "O2 B1S1",       unit: "V",    color: "#00E87A" },
  { key: "batteryVoltage",label: "BATTERY",      unit: "V",    color: "#00D4FF" },
  { key: "fuelLevel",    label: "FUEL",          unit: "%",    color: "#00E87A" },
  { key: "oilTemp",      label: "OIL TEMP",      unit: "°C",   color: "#FF6B6B" },
] as const;

function SensorCell({ label, value, unit, color }: {
  label: string; value: number | null | undefined; unit: string; color: string;
}) {
  const colors = useColors();
  const hasValue = value != null;
  return (
    <View style={[styles.sensorCell, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.sensorLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.sensorValue, { color: hasValue ? color : colors.border }]}>
        {hasValue ? (typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value) : "--"}
      </Text>
      <Text style={[styles.sensorUnit, { color: colors.mutedForeground }]}>{unit}</Text>
    </View>
  );
}

export function DTCItem({ entry, freezeFrame, isFetchingFreezeFrame, onFetchFreezeFrame }: DTCItemProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_COLORS[entry.severity];
  const systemColor = SYSTEM_COLORS[entry.system];

  const handleToggle = () => {
    setExpanded((v) => !v);
    Haptics.selectionAsync();
  };

  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: sev }]}>
      {/* ── Header (always visible, tappable) ─────────────────────────── */}
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.75} style={styles.header}>
        <View style={styles.codeRow}>
          <Feather name={SEVERITY_ICONS[entry.severity]} size={14} color={sev} />
          <Text style={[styles.code, { color: sev }]}>{entry.code}</Text>
          <View style={[styles.systemBadge, { backgroundColor: systemColor + "20" }]}>
            <Text style={[styles.systemText, { color: systemColor }]}>{SYSTEM_LABELS[entry.system]}</Text>
          </View>
        </View>
        <Text style={[styles.description, { color: colors.foreground }]} numberOfLines={expanded ? undefined : 2}>
          {entry.description}
        </Text>
        <View style={styles.expandRow}>
          <Text style={[styles.expandHint, { color: colors.mutedForeground }]}>
            {expanded ? "TAP TO COLLAPSE" : "TAP FOR FREEZE FRAME"}
          </Text>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {/* ── Expanded body ─────────────────────────────────────────────── */}
      {expanded && (
        <View style={[styles.body, { borderTopColor: colors.border }]}>
          {/* Hint */}
          {entry.hint && (
            <View style={[styles.hintRow, { borderBottomColor: colors.border }]}>
              <Feather name="tool" size={10} color={colors.mutedForeground} />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>{entry.hint}</Text>
            </View>
          )}

          {/* Freeze frame section */}
          <View style={styles.freezeSection}>
            <View style={styles.freezeHeader}>
              <MaterialCommunityIcons name="camera-burst" size={14} color={colors.primary} />
              <Text style={[styles.freezeTitle, { color: colors.primary }]}>FREEZE FRAME</Text>
              {freezeFrame?.timestamp && (
                <Text style={[styles.freezeTimestamp, { color: colors.mutedForeground }]}>
                  {freezeFrame.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </Text>
              )}
            </View>

            {/* Not fetched yet — show capture button */}
            {!freezeFrame && !isFetchingFreezeFrame && onFetchFreezeFrame && (
              <TouchableOpacity
                style={[styles.captureBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
                onPress={() => { onFetchFreezeFrame(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="camera-burst" size={16} color={colors.primary} />
                <Text style={[styles.captureBtnText, { color: colors.primary }]}>CAPTURE ENGINE SNAPSHOT</Text>
              </TouchableOpacity>
            )}

            {/* Not connected */}
            {!freezeFrame && !isFetchingFreezeFrame && !onFetchFreezeFrame && (
              <View style={styles.notConnected}>
                <Text style={[styles.notConnectedText, { color: colors.mutedForeground }]}>
                  Connect to ELM327 to read freeze frame data
                </Text>
              </View>
            )}

            {/* Loading */}
            {isFetchingFreezeFrame && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Reading Mode 02 data from ECU…
                </Text>
              </View>
            )}

            {/* Sensor grid */}
            {freezeFrame && !isFetchingFreezeFrame && (
              <>
                <View style={styles.sensorGrid}>
                  {FREEZE_CELLS.map(({ key, label, unit, color }) => (
                    <SensorCell
                      key={key}
                      label={label}
                      value={(freezeFrame.data as any)[key]}
                      unit={unit}
                      color={color}
                    />
                  ))}
                </View>
                {/* Re-capture button */}
                {onFetchFreezeFrame && (
                  <TouchableOpacity
                    style={[styles.recaptureBtn, { borderColor: colors.border }]}
                    onPress={() => { onFetchFreezeFrame(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    activeOpacity={0.7}
                  >
                    <Feather name="refresh-cw" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.recaptureBtnText, { color: colors.mutedForeground }]}>RE-CAPTURE</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    borderRadius: 10, borderWidth: 1, borderLeftWidth: 3,
    overflow: "hidden", marginBottom: 8,
  },
  header: { padding: 12, gap: 4 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  code: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  systemBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  systemText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  expandRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 },
  expandHint: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.8 },
  body: { borderTopWidth: 1 },
  hintRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1,
  },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
  freezeSection: { padding: 12, gap: 10 },
  freezeHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  freezeTitle: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2, flex: 1 },
  freezeTimestamp: { fontSize: 10, fontFamily: "Inter_400Regular" },
  captureBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1, borderRadius: 8, paddingVertical: 12,
  },
  captureBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  notConnected: { alignItems: "center", paddingVertical: 12 },
  notConnectedText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sensorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sensorCell: {
    width: "30.5%", borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 8, gap: 2, alignItems: "center",
  },
  sensorLabel: { fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textAlign: "center" },
  sensorValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sensorUnit: { fontSize: 8, fontFamily: "Inter_400Regular" },
  recaptureBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, borderWidth: 1, borderRadius: 6, paddingVertical: 6, marginTop: 2,
  },
  recaptureBtnText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
});
