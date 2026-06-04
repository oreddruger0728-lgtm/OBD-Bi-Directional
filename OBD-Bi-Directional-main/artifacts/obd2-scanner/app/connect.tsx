import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOBD2, type ConnectionMode } from "@/contexts/OBD2Context";
import { useColors } from "@/hooks/useColors";
import { type BTDevice } from "@/utils/bluetoothTransport";

// ── Mode card ─────────────────────────────────────────────────────────────────
interface ModeCardProps {
  mode: ConnectionMode;
  title: string;
  subtitle: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
  badgeText?: string;
  badgeColor?: string;
  disabled?: boolean;
  disabledReason?: string;
}

function ModeCard({
  title, subtitle, icon, selected, onSelect, badgeText,
  badgeColor = "#00E87A", disabled, disabledReason,
}: ModeCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.modeCard,
        {
          backgroundColor: selected ? colors.primary + "15" : colors.card,
          borderColor: selected ? colors.primary : disabled ? colors.border + "60" : colors.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      onPress={disabled ? undefined : onSelect}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <View style={[styles.modeIconContainer, { backgroundColor: selected ? colors.primary + "30" : colors.secondary }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={selected ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={styles.modeInfo}>
        <View style={styles.modeTitleRow}>
          <Text style={[styles.modeTitle, { color: disabled ? colors.mutedForeground : colors.foreground }]}>{title}</Text>
          {badgeText && (
            <View style={[styles.badge, { backgroundColor: badgeColor + "25" }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.modeSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        {disabled && disabledReason && (
          <Text style={[styles.disabledReason, { color: "#FFB800" }]}>{disabledReason}</Text>
        )}
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.4 : 1 }]}>
        {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
      </View>
    </TouchableOpacity>
  );
}

// ── BT device row ─────────────────────────────────────────────────────────────
function BTDeviceRow({
  device, selected, onSelect,
}: {
  device: BTDevice; selected: boolean; onSelect: () => void;
}) {
  const colors = useColors();
  const isELM = device.name.toUpperCase().includes("ELM") ||
    device.name.toUpperCase().includes("OBD") ||
    device.name.toUpperCase().includes("OBDII") ||
    device.name.toUpperCase().includes("VLINK") ||
    device.name.toUpperCase().includes("KONNWEI") ||
    device.name.toUpperCase().includes("VEEPEAK");

  return (
    <TouchableOpacity
      style={[
        styles.deviceRow,
        {
          backgroundColor: selected ? colors.primary + "15" : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      <View style={[styles.deviceIcon, { backgroundColor: selected ? colors.primary + "25" : colors.secondary }]}>
        <MaterialCommunityIcons
          name={isELM ? "bluetooth-connect" : "bluetooth"}
          size={18}
          color={selected ? colors.primary : colors.mutedForeground}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.deviceName, { color: colors.foreground }]}>{device.name}</Text>
        <Text style={[styles.deviceAddress, { color: colors.mutedForeground }]}>{device.address}</Text>
      </View>
      {isELM && (
        <View style={[styles.elmBadge, { backgroundColor: "#00D4FF20", borderColor: "#00D4FF40" }]}>
          <Text style={styles.elmBadgeText}>ELM327</Text>
        </View>
      )}
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
        {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ConnectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    connectionMode, connectionStatus, wifiHost, wifiPort, btAvailable,
    btDeviceAddress, btDeviceName, pairedDevices, isScanningBT,
    setConnectionMode, setWifiHost, setWifiPort, setBTDevice,
    scanPairedDevices, connect, disconnect,
  } = useOBD2();

  const isConnected = connectionStatus === "CONNECTED";
  const isConnecting = connectionStatus === "CONNECTING";
  const [editHost, setEditHost] = useState(wifiHost);
  const [editPort, setEditPort] = useState(wifiPort.toString());

  useEffect(() => {
    if (connectionMode === "BT" && btAvailable && pairedDevices.length === 0) {
      scanPairedDevices();
    }
  // ── FIX: correct dependency array — don't include pairedDevices
  }, [connectionMode, btAvailable]);

  const handleConnect = async () => {
    if (connectionMode === "WIFI") {
      setWifiHost(editHost);
      setWifiPort(parseInt(editPort, 10) || 35000);
    }
    if (connectionMode === "BT" && !btDeviceAddress) {
      Alert.alert("No Device Selected", "Select a paired Bluetooth device before connecting.");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ── FIX: connect() now returns a boolean so we don't race against
    //         React state updating asynchronously after await.
    const success = await connect();

    if (success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Connection Failed",
        connectionMode === "BT"
          ? "Could not connect to the ELM327 adapter. Make sure it's powered on and paired in Bluetooth settings."
          : connectionMode === "WIFI"
          ? "Could not connect. Make sure your phone is on the adapter WiFi hotspot and the IP/port are correct. Common defaults: 192.168.0.10:35000"
          : "Demo mode failed to start. Please try again."
      );
    }
  };

  const handleDisconnect = () => {
    disconnect();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
          <Feather name="x" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>ELM327 Connection</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONNECTION MODE</Text>

        {/* Demo */}
        <ModeCard
          mode="DEMO"
          title="Demo Mode"
          subtitle="Simulated engine data — no adapter required"
          icon="car-electric"
          selected={connectionMode === "DEMO"}
          onSelect={() => setConnectionMode("DEMO")}
          badgeText="WORKS NOW"
          badgeColor="#00E87A"
        />

        {/* Bluetooth Classic */}
        <ModeCard
          mode="BT"
          title="Bluetooth ELM327"
          subtitle="Pair your ELM327 adapter in Android settings, then select it below"
          icon="bluetooth-connect"
          selected={connectionMode === "BT"}
          onSelect={() => setConnectionMode("BT")}
          badgeText={btAvailable ? "READY" : "NEEDS BUILD"}
          badgeColor={btAvailable ? "#00D4FF" : "#FFB800"}
          disabled={!btAvailable}
          disabledReason={!btAvailable ? "Install via EAS Build APK — not supported in Expo Go" : undefined}
        />

        {/* BT device picker */}
        {connectionMode === "BT" && btAvailable && (
          <View style={[styles.btPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.btPanelHeader}>
              <Text style={[styles.btPanelTitle, { color: colors.mutedForeground }]}>PAIRED DEVICES</Text>
              <TouchableOpacity
                onPress={scanPairedDevices}
                disabled={isScanningBT}
                style={[styles.refreshBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                {isScanningBT
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />}
              </TouchableOpacity>
            </View>

            {pairedDevices.length === 0 && !isScanningBT && (
              <View style={styles.noDevices}>
                <MaterialCommunityIcons name="bluetooth-off" size={28} color={colors.border} />
                <Text style={[styles.noDevicesText, { color: colors.mutedForeground }]}>
                  No paired devices found
                </Text>
                <Text style={[styles.noDevicesHint, { color: colors.mutedForeground }]}>
                  Pair your ELM327 in Android Settings → Bluetooth.{"\n"}
                  Default PIN is usually <Text style={{ color: colors.primary }}>1234</Text> or <Text style={{ color: colors.primary }}>0000</Text>.{"\n\n"}
                  If a permission popup appears, tap <Text style={{ color: colors.primary }}>Allow</Text> for Nearby devices, then press Refresh.
                </Text>
              </View>
            )}

            {pairedDevices.map((device) => (
              <BTDeviceRow
                key={device.address}
                device={device}
                selected={btDeviceAddress === device.address}
                onSelect={() => {
                  setBTDevice(device.address, device.name);
                  Haptics.selectionAsync();
                }}
              />
            ))}

            {btDeviceAddress ? (
              <View style={[styles.selectedDevice, { backgroundColor: "#00D4FF10", borderColor: "#00D4FF30" }]}>
                <MaterialCommunityIcons name="bluetooth-connect" size={14} color="#00D4FF" />
                <Text style={[styles.selectedDeviceText, { color: "#00D4FF" }]}>
                  Selected: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{btDeviceName || btDeviceAddress}</Text>
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* EAS Build instructions when BT not available */}
        {connectionMode === "BT" && !btAvailable && (
          <View style={[styles.buildInstructions, { backgroundColor: colors.card, borderColor: "#FFB800" }]}>
            <View style={styles.buildInstructionsHeader}>
              <MaterialCommunityIcons name="package-variant-closed" size={16} color="#FFB800" />
              <Text style={[styles.buildInstructionsTitle, { color: "#FFB800" }]}>Build Custom APK</Text>
            </View>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>
              1. Install EAS CLI:{" "}
              <Text style={[styles.buildCode, { color: colors.primary, backgroundColor: colors.secondary }]}>
                npm install -g eas-cli
              </Text>
            </Text>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>
              2. Log in:{" "}
              <Text style={[styles.buildCode, { color: colors.primary, backgroundColor: colors.secondary }]}>
                eas login
              </Text>
            </Text>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>
              3. Build APK:{" "}
              <Text style={[styles.buildCode, { color: colors.primary, backgroundColor: colors.secondary }]}>
                eas build --platform android --profile preview
              </Text>
            </Text>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>
              4. Install the APK on your phone and open this app
            </Text>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>
              5. Pair your ELM327 in Android Bluetooth Settings (PIN: 1234)
            </Text>
          </View>
        )}

        {/* WiFi */}
        <ModeCard
          mode="WIFI"
          title="WiFi ELM327"
          subtitle="Connect your phone to the adapter's WiFi hotspot, then enter its IP and port below"
          icon="wifi"
          selected={connectionMode === "WIFI"}
          onSelect={() => setConnectionMode("WIFI")}
          badgeText="READY"
          badgeColor="#00D4FF"
        />

        {connectionMode === "WIFI" && (
          <View style={[styles.wifiConfig, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.wifiConfigTitle, { color: colors.mutedForeground }]}>WiFi ADAPTER SETTINGS</Text>
            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>IP Address</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={editHost} onChangeText={setEditHost}
                placeholder="192.168.0.10"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputRow}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Port</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={editPort} onChangeText={setEditPort}
                placeholder="35000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}

        {connectionMode === "WIFI" && (
          <View style={[styles.buildInstructions, { backgroundColor: colors.card, borderColor: "#00D4FF40" }]}>
            <View style={styles.buildInstructionsHeader}>
              <MaterialCommunityIcons name="wifi" size={15} color="#00D4FF" />
              <Text style={[styles.buildInstructionsTitle, { color: "#00D4FF" }]}>WiFi Setup Steps</Text>
            </View>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>1. Plug ELM327 into OBD2 port</Text>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>{"2. Phone: Settings → WiFi → connect to adapter hotspot (e.g. "OBDII" or "ELM327")"}</Text>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>{"3. Common defaults: 192.168.0.10 : 35000"}</Text>
            <Text style={[styles.buildStep, { color: colors.mutedForeground }]}>{"4. Enter IP and port above, tap CONNECT"}</Text>
            <Text style={[styles.buildStep, { color: "#FFB800" }]}>{"⚠ Internet unavailable while on adapter hotspot"}</Text>
          </View>
        )}

        {/* Init sequence reference */}
        <View style={[styles.atInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.atTitle, { color: colors.mutedForeground }]}>ELM327 INIT SEQUENCE</Text>
          {["ATZ — Reset adapter", "ATE0 — Echo off", "ATL0 — Linefeeds off", "ATS0 — Spaces off", "ATH1 — Headers on", "ATSP0 — Auto protocol detect"].map((line) => (
            <Text key={line} style={[styles.atLine, { color: colors.foreground + "99" }]}>{line}</Text>
          ))}
        </View>

        {/* Connect / Disconnect button */}
        {isConnected ? (
          <TouchableOpacity
            style={[styles.connectBtn, { backgroundColor: "#FF444420", borderColor: "#FF4444" }]}
            onPress={handleDisconnect} activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="bluetooth-off" size={18} color="#FF4444" />
            <Text style={[styles.connectBtnText, { color: "#FF4444" }]}>DISCONNECT</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.connectBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleConnect}
            disabled={isConnecting || (connectionMode === "BT" && !btAvailable)}
            activeOpacity={0.8}
          >
            {isConnecting ? (
              <>
                <ActivityIndicator color={colors.primaryForeground} />
                <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>
                  {connectionMode === "BT" ? "INITIALIZING ELM327…" : "CONNECTING…"}
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons
                  name={connectionMode === "BT" ? "bluetooth-connect" : connectionMode === "WIFI" ? "wifi" : "car-electric"}
                  size={18}
                  color={colors.primaryForeground}
                />
                <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>CONNECT</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 10 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginBottom: 2 },
  modeCard: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderRadius: 12, padding: 14, gap: 12,
  },
  modeIconContainer: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modeInfo: { flex: 1, gap: 3 },
  modeTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modeTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modeSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  disabledReason: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  btPanel: { borderWidth: 1, borderRadius: 10, overflow: "hidden", gap: 6, padding: 12 },
  btPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  btPanelTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  refreshBtn: { borderWidth: 1, borderRadius: 6, padding: 6 },
  noDevices: { alignItems: "center", paddingVertical: 16, gap: 8 },
  noDevicesText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  noDevicesHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 17 },
  deviceRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 8, padding: 10,
  },
  deviceIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  deviceName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  deviceAddress: { fontSize: 10, fontFamily: "Inter_400Regular" },
  elmBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  elmBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#00D4FF" },
  selectedDevice: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4,
  },
  selectedDeviceText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  buildInstructions: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  buildInstructionsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  buildInstructionsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  buildStep: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 20 },
  buildCode: { fontFamily: "Inter_500Medium", fontSize: 11, borderRadius: 3, paddingHorizontal: 4 },
  wifiConfig: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  wifiConfigTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 80 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "right" },
  atInfo: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  atTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
  atLine: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  connectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, marginTop: 4,
  },
  connectBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
});
