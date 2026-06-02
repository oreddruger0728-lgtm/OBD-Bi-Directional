import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOBD2 } from "@/contexts/OBD2Context";
import { useColors } from "@/hooks/useColors";

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
      {label}
    </Text>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────
interface RowProps {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}

function SettingsRow({
  icon, iconColor, label, sublabel, value, onPress, rightElement, destructive,
}: RowProps) {
  const colors = useColors();
  const tint = iconColor ?? colors.primary;
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint + "20" }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={tint} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: destructive ? "#FF4444" : colors.foreground }]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sublabel}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
      ) : null}
      {rightElement ?? null}
      {onPress && !rightElement ? (
        <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      {children}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    connectionMode, wifiHost, wifiPort, btDeviceName, btDeviceAddress,
    vehicleSpecs, clearVehicleSpecs, disconnect, connectionStatus,
  } = useOBD2();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imperialUnits, setImperialUnits] = useState(false);

  const isConnected = connectionStatus === "CONNECTED";

  const handleClearVehicle = () => {
    Alert.alert(
      "Clear Vehicle Data",
      "This will remove the saved VIN decode result. You can re-scan from the Vehicle tab.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearVehicleSpecs(),
        },
      ]
    );
  };

  const handleDisconnect = () => {
    Alert.alert("Disconnect", "Disconnect from the current adapter?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: () => {
          disconnect();
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, paddingTop: insets.top + 8 },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
        >
          <Feather name="x" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Connection ───────────────────────────────────────────────────── */}
        <SectionHeader label="CONNECTION" />
        <Card>
          <SettingsRow
            icon="bluetooth-connect"
            iconColor={colors.primary}
            label="Adapter Setup"
            sublabel="Change mode, device, or IP address"
            onPress={() => router.push("/connect")}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon={connectionMode === "BT" ? "bluetooth" : connectionMode === "WIFI" ? "wifi" : "car-electric"}
            iconColor="#6B7280"
            label="Active Mode"
            value={connectionMode}
          />
          {connectionMode === "BT" && btDeviceName ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SettingsRow
                icon="bluetooth-settings"
                iconColor="#6B7280"
                label="Saved Device"
                value={btDeviceName || btDeviceAddress}
              />
            </>
          ) : null}
          {connectionMode === "WIFI" ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SettingsRow
                icon="ip-network-outline"
                iconColor="#6B7280"
                label="WiFi Address"
                value={`${wifiHost}:${wifiPort}`}
              />
            </>
          ) : null}
          {isConnected ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SettingsRow
                icon="power-plug-off"
                iconColor="#FF4444"
                label="Disconnect"
                sublabel="End the current adapter session"
                onPress={handleDisconnect}
                destructive
              />
            </>
          ) : null}
        </Card>

        {/* ── Vehicle ──────────────────────────────────────────────────────── */}
        <SectionHeader label="VEHICLE" />
        <Card>
          <SettingsRow
            icon="car-info"
            iconColor="#A78BFA"
            label="Saved Vehicle"
            sublabel={
              vehicleSpecs
                ? `${vehicleSpecs.year ?? ""} ${vehicleSpecs.make ?? ""} ${vehicleSpecs.model ?? ""}`.trim() || "Decoded from VIN"
                : "No vehicle saved yet"
            }
          />
          {vehicleSpecs ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SettingsRow
                icon="delete-outline"
                iconColor="#FF4444"
                label="Clear Vehicle Data"
                sublabel="Remove saved VIN decode result"
                onPress={handleClearVehicle}
                destructive
              />
            </>
          ) : null}
        </Card>

        {/* ── Display ──────────────────────────────────────────────────────── */}
        <SectionHeader label="DISPLAY" />
        <Card>
          <SettingsRow
            icon="speedometer"
            iconColor="#FFB800"
            label="Imperial Units"
            sublabel="Show mph and °F instead of km/h and °C"
            rightElement={
              <Switch
                value={imperialUnits}
                onValueChange={setImperialUnits}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={imperialUnits ? colors.primary : colors.mutedForeground}
              />
            }
          />
        </Card>

        {/* ── Advanced ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.advancedToggle, { borderColor: colors.border }]}
          onPress={() => setShowAdvanced((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={[styles.advancedToggleText, { color: colors.mutedForeground }]}>
            ADVANCED
          </Text>
          <Feather
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>

        {showAdvanced && (
          <Card>
            <SettingsRow
              icon="swap-horizontal"
              iconColor="#00D4FF"
              label="ELM327 Init Sequence"
              sublabel="ATZ · ATE0 · ATL0 · ATS0 · ATH1 · ATSP0"
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingsRow
              icon="barcode-scan"
              iconColor="#34D399"
              label="OBD Protocol"
              sublabel="Auto-detect (ATSP0) — changes in adapter setup"
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingsRow
              icon="timer-outline"
              iconColor="#6B7280"
              label="PID Poll Interval"
              value="500 ms"
            />
          </Card>
        )}

        {/* ── About ────────────────────────────────────────────────────────── */}
        <SectionHeader label="ABOUT" />
        <Card>
          <SettingsRow
            icon="information-outline"
            iconColor="#6B7280"
            label="App Version"
            value="1.0.0"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="shield-check-outline"
            iconColor="#00E87A"
            label="Supports OBD2 / EOBD"
            sublabel="ISO 15765-4 CAN · J1850 · ISO 9141 · KWP2000"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="antenna"
            iconColor="#6B7280"
            label="ELM327 Firmware"
            sublabel="v1.5 and above recommended"
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 6 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginTop: 10,
    marginBottom: 6,
    marginLeft: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  divider: { height: 1, marginLeft: 54 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  rowValue: { fontSize: 12, fontFamily: "Inter_500Medium" },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  advancedToggleText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
});
