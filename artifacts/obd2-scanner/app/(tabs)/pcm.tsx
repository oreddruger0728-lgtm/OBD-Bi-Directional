import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { useOBD2 } from "@/contexts/OBD2Context";
import { useColors } from "@/hooks/useColors";

type LogRow = { label: string; value: string; ok?: boolean };

const PCM_READS = [
  { label: "VIN", cmd: "0902", timeout: 5000 },
  { label: "Calibration ID", cmd: "0904", timeout: 5000 },
  { label: "Calibration Verification Number", cmd: "0906", timeout: 5000 },
  { label: "ECU Name", cmd: "090A", timeout: 5000 },
  { label: "Monitor Status", cmd: "0101", timeout: 3000 },
  { label: "Supported PIDs 01-20", cmd: "0100", timeout: 3000 },
  { label: "Supported PIDs 21-40", cmd: "0120", timeout: 3000 },
];

function clean(raw: string) {
  return raw.replace(/\r/g, " ").replace(/\n/g, " ").replace(/>/g, "").replace(/\s+/g, " ").trim();
}

export default function PcmScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { connectionStatus, sendRawCommand } = useOBD2();
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [did, setDid] = useState("F190");
  const [customCmd, setCustomCmd] = useState("");

  const connected = connectionStatus === "CONNECTED";
  const canReadDid = useMemo(() => /^[0-9A-Fa-f]{4}$/.test(did.trim()), [did]);

  const addLog = (row: LogRow) => setLogs((prev) => [row, ...prev].slice(0, 30));

  const runReadAll = async () => {
    if (!connected) { Alert.alert("Not Connected", "Connect to Demo or a Bluetooth ELM327 adapter first."); return; }
    setBusy(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    for (const item of PCM_READS) {
      try {
        const raw = await sendRawCommand(item.cmd, item.timeout);
        addLog({ label: `${item.label} (${item.cmd})`, value: clean(raw), ok: !/NO DATA|ERROR|UNABLE|\?/i.test(raw) });
      } catch (e: any) {
        addLog({ label: `${item.label} (${item.cmd})`, value: e?.message ?? "No response", ok: false });
      }
    }
    setBusy(false);
  };

  const runReadDid = async () => {
    if (!connected || !canReadDid) return;
    setBusy(true);
    try {
      const cmd = `22${did.trim().toUpperCase()}`;
      const raw = await sendRawCommand(cmd, 5000);
      addLog({ label: `Read DID ${did.trim().toUpperCase()}`, value: clean(raw), ok: !/NO DATA|ERROR|UNABLE|\?/i.test(raw) });
    } catch (e: any) {
      addLog({ label: `Read DID ${did.trim().toUpperCase()}`, value: e?.message ?? "No response", ok: false });
    }
    setBusy(false);
  };

  const runCustomRead = async () => {
    const cmd = customCmd.replace(/\s+/g, "").toUpperCase();
    if (!connected || !/^(01|02|03|04|09|22|AT)[0-9A-Z]*$/.test(cmd)) {
      Alert.alert("Safe commands only", "This box allows standard OBD-II reads/clears, Mode 22 data reads, and ELM327 AT setup commands. PCM flashing/writing routines are intentionally not sent here.");
      return;
    }
    setBusy(true);
    try {
      const raw = await sendRawCommand(cmd, 5000);
      addLog({ label: `Custom ${cmd}`, value: clean(raw), ok: !/NO DATA|ERROR|UNABLE|\?/i.test(raw) });
    } catch (e: any) {
      addLog({ label: `Custom ${cmd}`, value: e?.message ?? "No response", ok: false });
    }
    setBusy(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <ConnectionBar />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "20" }]}><MaterialCommunityIcons name="chip" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>PCM Read / Safe Write</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Reads standard PCM identifiers and DIDs. Write/flash routines are guarded because they are vehicle-specific and can brick modules.</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]} onPress={runReadAll} disabled={busy}>
          {busy ? <ActivityIndicator color="#000" /> : <><Feather name="download" size={16} color="#000" /><Text style={styles.primaryBtnText}>READ PCM INFO</Text></>}
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Read Data Identifier</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>UDS Mode 22 read. Example: F190 is commonly VIN on many vehicles.</Text>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} value={did} onChangeText={setDid} autoCapitalize="characters" maxLength={4} placeholder="F190" placeholderTextColor={colors.mutedForeground} />
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: canReadDid ? colors.primary : colors.border }]} onPress={runReadDid} disabled={!canReadDid || busy}><Text style={styles.smallBtnText}>READ</Text></TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Safe Command Console</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Allowed: Modes 01/02/03/04/09, Mode 22 reads, and ELM327 AT commands.</Text>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} value={customCmd} onChangeText={setCustomCmd} autoCapitalize="characters" placeholder="010C" placeholderTextColor={colors.mutedForeground} />
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.primary }]} onPress={runCustomRead} disabled={busy}><Text style={styles.smallBtnText}>SEND</Text></TouchableOpacity>
          </View>
        </View>

        <View style={[styles.warn, { backgroundColor: "#FFB80015", borderColor: "#FFB800" }]}> 
          <Feather name="alert-triangle" size={15} color="#FFB800" />
          <Text style={styles.warnText}>PCM flash/write-by-address commands are not sent from this tab. Use OEM subscriptions/J2534 tooling and verified files for real calibration flashing.</Text>
        </View>

        <Text style={[styles.logTitle, { color: colors.mutedForeground }]}>RESPONSE LOG</Text>
        {logs.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No PCM reads yet.</Text> : logs.map((row, i) => (
          <View key={`${row.label}-${i}`} style={[styles.logRow, { backgroundColor: colors.card, borderColor: row.ok === false ? "#FF4444" : colors.border }]}> 
            <Text style={[styles.logLabel, { color: row.ok === false ? "#FF4444" : colors.foreground }]}>{row.label}</Text>
            <Text style={[styles.logValue, { color: colors.mutedForeground }]} selectable>{row.value || "No response"}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 12, gap: 10 },
  hero: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  heroIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 3 },
  primaryBtn: { height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryBtnText: { color: "#000", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  cardTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 40, fontFamily: "Inter_500Medium", fontSize: 13 },
  smallBtn: { height: 40, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  smallBtnText: { color: "#000", fontFamily: "Inter_700Bold", fontSize: 12 },
  warn: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderRadius: 10, padding: 10 },
  warnText: { color: "#FFB800", flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", lineHeight: 16 },
  logTitle: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginTop: 4 },
  empty: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 22 },
  logRow: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 5 },
  logLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  logValue: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
