import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { useOBD2 } from "@/contexts/OBD2Context";
import { useColors } from "@/hooks/useColors";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PCMReadResult {
  label: string;
  value: string;
  raw?: string;
  ok: boolean;
}

interface AdaptBlock {
  id: string;
  label: string;
  did: string;           // 2-byte DID hex
  moduleAddr: string;
}

const ADAPT_BLOCKS: AdaptBlock[] = [
  { id: "ltft_b1",    label: "Long-Term Fuel Trim B1", did: "0200", moduleAddr: "7E0" },
  { id: "ltft_b2",    label: "Long-Term Fuel Trim B2", did: "0201", moduleAddr: "7E0" },
  { id: "idle_adapt", label: "Idle Speed Adaptation",  did: "0105", moduleAddr: "7E0" },
  { id: "maf_adapt",  label: "MAF Airflow Adaptation", did: "0201", moduleAddr: "7E0" },
  { id: "trans_a",    label: "Trans Shift Adapt A",    did: "0300", moduleAddr: "7E1" },
  { id: "trans_b",    label: "Trans Shift Adapt B",    did: "0301", moduleAddr: "7E1" },
  { id: "tcc_slip",   label: "TCC Slip Target",        did: "0302", moduleAddr: "7E1" },
];

const MODULE_LIST = [
  { label: "ECM — Engine Control",      addr: "7E0", rxAddr: "7E8" },
  { label: "TCM — Transmission",        addr: "7E1", rxAddr: "7E9" },
  { label: "BCM — Body Control",        addr: "7B3", rxAddr: "7BB" },
  { label: "ABS — Anti-Lock Brakes",    addr: "760", rxAddr: "768" },
  { label: "EPB — Electric Park Brake", addr: "761", rxAddr: "769" },
  { label: "EPS — Power Steering",      addr: "730", rxAddr: "738" },
  { label: "HVAC — Climate Control",    addr: "7C0", rxAddr: "7C8" },
  { label: "IC  — Instrument Cluster",  addr: "7A0", rxAddr: "7A8" },
  { label: "TPMS — Tire Pressure",      addr: "7A8", rxAddr: "7B0" },
  { label: "SRS — Airbag",              addr: "7D0", rxAddr: "7D8" },
];

// ── Helper: result row ────────────────────────────────────────────────────────
function ResultRow({ item, colors }: { item: PCMReadResult; colors: any }) {
  return (
    <View style={[styles.resultRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
      <Text style={[styles.resultValue, { color: item.ok ? colors.foreground : "#FF4444" }]}>
        {item.value}
      </Text>
      {item.raw ? (
        <Text style={[styles.resultRaw, { color: colors.mutedForeground }]}>{item.raw}</Text>
      ) : null}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PCMScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { connectionStatus, sendRawCommand } = useOBD2();
  const isConnected = connectionStatus === "CONNECTED";

  const [activeTab, setActiveTab] = useState<"read" | "adapt" | "raw">("read");
  const [reading, setReading] = useState(false);
  const [results, setResults] = useState<PCMReadResult[]>([]);
  const [selectedModule, setSelectedModule] = useState(MODULE_LIST[0]);
  const [adaptResults, setAdaptResults] = useState<{ label: string; value: string; raw: string }[]>([]);
  const [readingAdapt, setReadingAdapt] = useState(false);
  const [rawCmd, setRawCmd] = useState("");
  const [rawLog, setRawLog] = useState<string[]>([]);
  const [sendingRaw, setSendingRaw] = useState(false);

  // ── Read PCM Info (Mode 09) ───────────────────────────────────────────────
  const readPCMInfo = async () => {
    if (!isConnected) return;
    setReading(true);
    setResults([]);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const out: PCMReadResult[] = [];

    const queries: { label: string; cmd: string; parser: (raw: string) => string }[] = [
      {
        label: "VIN (Mode 09 PID 02)",
        cmd: "0902",
        parser: (r) => {
          const hex = r.replace(/\s|49\s02\s\w\d\s/g, "").replace(/[^0-9A-Fa-f]/g, "");
          try {
            let vin = "";
            for (let i = 0; i < hex.length - 1; i += 2) {
              const code = parseInt(hex.slice(i, i + 2), 16);
              if (code >= 32 && code < 127) vin += String.fromCharCode(code);
            }
            return vin.length >= 10 ? vin.trim() : "(no VIN returned)";
          } catch { return "(parse error)"; }
        },
      },
      {
        label: "Calibration ID (Mode 09 PID 04)",
        cmd: "0904",
        parser: (r) => {
          const hex = r.replace(/\s|49\s04\s\w\d\s/g, "").replace(/[^0-9A-Fa-f]/g, "");
          try {
            let cal = "";
            for (let i = 0; i < hex.length - 1; i += 2) {
              const code = parseInt(hex.slice(i, i + 2), 16);
              if (code >= 32 && code < 127) cal += String.fromCharCode(code);
            }
            return cal.trim() || hex.slice(0, 20);
          } catch { return hex.slice(0, 20); }
        },
      },
      {
        label: "Calibration Verification # (CVN)",
        cmd: "0906",
        parser: (r) => {
          const hex = r.replace(/\s/g, "").replace(/4906\w\d/g, "");
          return hex.slice(0, 8).toUpperCase() || "(not supported)";
        },
      },
      {
        label: "ECU Name",
        cmd: "090A",
        parser: (r) => {
          const hex = r.replace(/\s|490A\w\d\s/g, "").replace(/[^0-9A-Fa-f]/g, "");
          try {
            let name = "";
            for (let i = 0; i < hex.length - 1; i += 2) {
              const code = parseInt(hex.slice(i, i + 2), 16);
              if (code >= 32 && code < 127) name += String.fromCharCode(code);
            }
            return name.trim() || "(not supported)";
          } catch { return "(parse error)"; }
        },
      },
      {
        label: "Battery Voltage (ATRV)",
        cmd: "ATRV",
        parser: (r) => r.trim() || "N/A",
      },
      {
        label: "OBD Protocol Detected",
        cmd: "ATDP",
        parser: (r) => r.trim() || "N/A",
      },
      {
        label: "ELM327 Firmware Version",
        cmd: "ATI",
        parser: (r) => r.trim() || "N/A",
      },
      {
        label: "Supported PID Bitmap (01 00)",
        cmd: "0100",
        parser: (r) => {
          const hex = r.replace(/\s/g, "").replace(/4100/g, "");
          return hex.slice(0, 8).toUpperCase() || "(not supported)";
        },
      },
    ];

    for (const q of queries) {
      try {
        const raw = await sendRawCommand(q.cmd, q.cmd.startsWith("AT") ? 1500 : 3000);
        const isError = raw.includes("ERROR") || raw.includes("NO DATA") || raw.includes("?");
        out.push({
          label: q.label,
          value: isError ? "(not supported)" : q.parser(raw),
          raw: raw.slice(0, 40),
          ok: !isError,
        });
      } catch {
        out.push({ label: q.label, value: "(timeout)", raw: "", ok: false });
      }
    }

    setResults(out);
    setReading(false);
  };

  // ── Read Adaptation Values (Mode 22 = UDS ReadDataByIdentifier) ───────────
  const readAdaptations = async () => {
    if (!isConnected) return;
    setReadingAdapt(true);
    setAdaptResults([]);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const out: { label: string; value: string; raw: string }[] = [];

    for (const block of ADAPT_BLOCKS) {
      try {
        // Set module header
        await sendRawCommand(`ATSH ${block.moduleAddr}`, 500);
        // UDS 0x22 = ReadDataByIdentifier
        const raw = await sendRawCommand(`22${block.did}`, 3000);
        if (raw.includes("ERROR") || raw.includes("NO DATA") || raw.includes("NR")) {
          out.push({ label: block.label, value: "Not supported", raw });
        } else {
          // Strip response SID (62) and DID echo, keep data bytes
          const clean = raw.replace(/\s/g, "");
          const dataStart = clean.indexOf("62") + 2 + block.did.length;
          const dataHex = clean.slice(dataStart, dataStart + 8);
          out.push({ label: block.label, value: dataHex || raw.slice(0, 20), raw });
        }
      } catch {
        out.push({ label: block.label, value: "(timeout)", raw: "" });
      }
    }

    // Reset to ECM header
    await sendRawCommand("ATSH 7E0", 500).catch(() => {});
    setAdaptResults(out);
    setReadingAdapt(false);
  };

  // ── Raw Command Terminal ──────────────────────────────────────────────────
  const sendRaw = async () => {
    if (!rawCmd.trim() || !isConnected) return;
    setSendingRaw(true);
    const cmd = rawCmd.trim().toUpperCase();
    try {
      const resp = await sendRawCommand(cmd, 5000);
      setRawLog((prev) => [`> ${cmd}`, `  ${resp.trim()}`, "", ...prev].slice(0, 100));
    } catch (e: any) {
      setRawLog((prev) => [`> ${cmd}`, `  ERROR: ${e?.message ?? "timeout"}`, "", ...prev].slice(0, 100));
    }
    setRawCmd("");
    setSendingRaw(false);
  };

  const TABS = [
    { id: "read" as const, label: "PCM Info", icon: "cpu" },
    { id: "adapt" as const, label: "Adaptations", icon: "sliders" },
    { id: "raw" as const, label: "Raw Terminal", icon: "terminal" },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ConnectionBar />

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.id ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.tabText, { color: activeTab === tab.id ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── PCM INFO TAB ──────────────────────────────────────────────────── */}
      {activeTab === "read" && (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="cpu-64-bit" size={16} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Module Identification</Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Reads VIN, calibration ID, CVN checksum, and ECU name via OBD2 Mode 09.
              Also reads battery voltage and ELM327 firmware version.
            </Text>

            {!isConnected && (
              <View style={[styles.notConnectedBox, { backgroundColor: "#FFB80015", borderColor: "#FFB800" }]}>
                <Feather name="alert-triangle" size={13} color="#FFB800" />
                <Text style={[styles.notConnectedText, { color: "#FFB800" }]}>
                  Connect to ELM327 adapter first
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.runBtn, { backgroundColor: colors.primary, opacity: isConnected ? 1 : 0.4 }]}
              onPress={readPCMInfo}
              disabled={!isConnected || reading}
              activeOpacity={0.8}
            >
              {reading
                ? <><ActivityIndicator color="#000" /><Text style={styles.runBtnText}>READING PCM…</Text></>
                : <><MaterialCommunityIcons name="download" size={16} color="#000" /><Text style={styles.runBtnText}>READ PCM INFO</Text></>
              }
            </TouchableOpacity>
          </View>

          {results.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 10 }]}>Results</Text>
              {results.map((r, i) => <ResultRow key={i} item={r} colors={colors} />)}
            </View>
          )}

          {/* Module address reference */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Module CAN Addresses</Text>
            {MODULE_LIST.map((m) => (
              <View key={m.addr} style={[styles.moduleRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.moduleLabel, { color: colors.foreground }]}>{m.label}</Text>
                <View style={styles.moduleAddrs}>
                  <Text style={[styles.moduleAddr, { color: colors.primary }]}>TX {m.addr}</Text>
                  <Text style={[styles.moduleAddr, { color: colors.mutedForeground }]}>RX {m.rxAddr}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── ADAPTATIONS TAB ───────────────────────────────────────────────── */}
      {activeTab === "adapt" && (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="tune-variant" size={16} color="#A78BFA" />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Adaptation Values</Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Reads live adaptation/learned values from ECM and TCM using UDS Mode 22
              (ReadDataByIdentifier). These are the values that get cleared by service resets.
            </Text>

            <TouchableOpacity
              style={[styles.runBtn, { backgroundColor: "#A78BFA", opacity: isConnected ? 1 : 0.4 }]}
              onPress={readAdaptations}
              disabled={!isConnected || readingAdapt}
              activeOpacity={0.8}
            >
              {readingAdapt
                ? <><ActivityIndicator color="#000" /><Text style={styles.runBtnText}>READING…</Text></>
                : <><MaterialCommunityIcons name="database-outline" size={16} color="#000" /><Text style={styles.runBtnText}>READ ADAPTATIONS</Text></>
              }
            </TouchableOpacity>
          </View>

          {adaptResults.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Adaptation Blocks</Text>
              {adaptResults.map((r, i) => (
                <View key={i} style={[styles.adaptRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.adaptLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
                  <Text style={[styles.adaptValue, { color: colors.foreground }]}>{r.value}</Text>
                  <Text style={[styles.adaptRaw, { color: colors.mutedForeground }]}>{r.raw.slice(0, 30)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.infoCard, { backgroundColor: "#FFB80010", borderColor: "#FFB800" }]}>
            <Feather name="info" size={13} color="#FFB800" />
            <Text style={[styles.infoText, { color: "#FFB800" }]}>
              Adaptation writing (PCM tuning/flashing) requires a J2534 pass-through device and
              manufacturer software. ELM327 does not support bootloader-level flash write operations.
              The Service Reset tab can clear/reset adaptation values safely.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ── RAW TERMINAL TAB ──────────────────────────────────────────────── */}
      {activeTab === "raw" && (
        <View style={[styles.terminal, { backgroundColor: colors.background }]}>
          <View style={[styles.terminalLog, { backgroundColor: "#0A0A0A", borderColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {rawLog.length === 0 && (
                <Text style={styles.terminalPlaceholder}>
                  {"// Raw ELM327 terminal\n// Examples:\n//   ATSH 7E0  — set ECM header\n//   22F190   — read VIN (UDS)\n//   0902     — read VIN (OBD2)\n//   ATDP     — show protocol\n//   ATRV     — battery voltage\n//   2703     — security seed\n//   04       — clear DTCs"}
                </Text>
              )}
              {rawLog.map((line, i) => (
                <Text
                  key={i}
                  style={[
                    styles.terminalLine,
                    line.startsWith(">") && styles.terminalCmd,
                    line.includes("ERROR") && styles.terminalError,
                  ]}
                >
                  {line}
                </Text>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.terminalInput, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.terminalField, { color: "#00E87A" }]}
              value={rawCmd}
              onChangeText={setRawCmd}
              placeholder="Enter AT command or OBD2 mode…"
              placeholderTextColor="#444"
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={sendRaw}
              returnKeyType="send"
              editable={isConnected}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: "#00E87A", opacity: isConnected ? 1 : 0.4 }]}
              onPress={sendRaw}
              disabled={!isConnected || sendingRaw}
            >
              {sendingRaw
                ? <ActivityIndicator color="#000" size="small" />
                : <Feather name="send" size={15} color="#000" />}
            </TouchableOpacity>
          </View>

          {!isConnected && (
            <View style={[styles.terminalDisabled, { backgroundColor: "#00000080" }]}>
              <Text style={{ color: "#888", fontSize: 13 }}>Connect to ELM327 to use terminal</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10 },
  tabText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  scroll: { padding: 12, gap: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 17 },
  notConnectedBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  notConnectedText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 12 },
  runBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000", letterSpacing: 1 },
  resultRow: { paddingVertical: 8, borderBottomWidth: 1, gap: 2 },
  resultLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  resultValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resultRaw: { fontSize: 9, fontFamily: "Inter_400Regular" },
  moduleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1 },
  moduleLabel: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },
  moduleAddrs: { flexDirection: "row", gap: 8 },
  moduleAddr: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  adaptRow: { paddingVertical: 8, borderBottomWidth: 1, gap: 2 },
  adaptLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  adaptValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  adaptRaw: { fontSize: 9, fontFamily: "Inter_400Regular" },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  infoText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 17, flex: 1 },
  terminal: { flex: 1 },
  terminalLog: { flex: 1, borderBottomWidth: 1, padding: 10 },
  terminalPlaceholder: { color: "#333", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 19 },
  terminalLine: { color: "#00E87A", fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  terminalCmd: { color: "#60A5FA" },
  terminalError: { color: "#FF4444" },
  terminalInput: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, padding: 10, gap: 8 },
  terminalField: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  sendBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  terminalDisabled: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
