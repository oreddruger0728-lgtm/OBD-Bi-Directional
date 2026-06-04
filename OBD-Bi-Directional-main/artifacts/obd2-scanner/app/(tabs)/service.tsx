import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { useOBD2 } from "@/contexts/OBD2Context";
import { SERVICE_CATEGORIES, SERVICE_RESETS, type OBDCommandStep, type ServiceReset } from "@/utils/serviceResets";
import { useColors } from "@/hooks/useColors";

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  Engine: "activity", Transmission: "git-branch", Brakes: "disc",
  Steering: "navigation", Tires: "circle", Body: "square",
  HVAC: "thermometer", Battery: "battery-charging", "Keys & Security": "key",
};
const CATEGORY_COLORS: Record<string, string> = {
  Engine: "#00D4FF", Transmission: "#A78BFA", Brakes: "#FF6B6B",
  Steering: "#34D399", Tires: "#FCD34D", Body: "#94A3B8",
  HVAC: "#60A5FA", Battery: "#F59E0B", "Keys & Security": "#E879F9",
};

// ── Per-command response state ────────────────────────────────────────────────
type CmdStatus = "idle" | "sending" | "ok" | "error" | "skipped";
interface CmdState {
  status: CmdStatus;
  response: string;
  editedCmd: string;
  editing: boolean;
}

// ── Single command row ────────────────────────────────────────────────────────
interface CmdRowProps {
  step: OBDCommandStep;
  index: number;
  state: CmdState;
  catColor: string;
  isConnected: boolean;
  onSend: (index: number, cmd: string) => void;
  onEdit: (index: number, val: string) => void;
  onToggleEdit: (index: number) => void;
}

function CommandRow({ step, index, state, catColor, isConnected, onSend, onEdit, onToggleEdit }: CmdRowProps) {
  const colors = useColors();

  const statusColor =
    state.status === "ok" ? "#00E87A" :
    state.status === "error" ? "#FF4444" :
    state.status === "sending" ? "#FFB800" :
    state.status === "skipped" ? "#6B7280" :
    colors.mutedForeground;

  const statusIcon =
    state.status === "ok" ? "check-circle" :
    state.status === "error" ? "x-circle" :
    state.status === "sending" ? "clock" :
    state.status === "skipped" ? "minus-circle" :
    "circle";

  return (
    <View style={[styles.cmdRow, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor:
      state.status === "ok" ? "#00E87A" :
      state.status === "error" ? "#FF4444" :
      state.status === "sending" ? "#FFB800" :
      catColor + "60"
    }]}>
      {/* Step number */}
      <View style={[styles.cmdIndex, { backgroundColor: catColor + "20" }]}>
        <Text style={[styles.cmdIndexText, { color: catColor }]}>{index + 1}</Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        {/* Description */}
        <Text style={[styles.cmdDesc, { color: colors.mutedForeground }]}>{step.desc}</Text>

        {/* Command field — editable or static */}
        {state.editing ? (
          <TextInput
            style={[styles.cmdInput, { color: "#00E87A", borderColor: catColor, backgroundColor: "#0A0A0A" }]}
            value={state.editedCmd}
            onChangeText={(v) => onEdit(index, v)}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => onToggleEdit(index)}
          />
        ) : (
          <TouchableOpacity onPress={() => onToggleEdit(index)} activeOpacity={0.7}>
            <View style={[styles.cmdCode, { backgroundColor: "#0A0A0A", borderColor: colors.border }]}>
              <Text style={[styles.cmdCodeText, { color: "#00E87A" }]}>{state.editedCmd}</Text>
              <Feather name="edit-2" size={10} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        )}

        {/* Response line */}
        {state.response ? (
          <View style={[styles.responseRow, { backgroundColor: state.status === "error" ? "#FF444410" : "#00E87A08" }]}>
            <Text style={[styles.responseText, { color: statusColor }]}>
              ← {state.response}
            </Text>
          </View>
        ) : null}

        {/* Timeout badge */}
        {step.timeoutMs && step.timeoutMs > 3000 && (
          <Text style={[styles.timeoutBadge, { color: colors.mutedForeground }]}>
            timeout {(step.timeoutMs / 1000).toFixed(0)}s
          </Text>
        )}
      </View>

      {/* Status icon + Send button */}
      <View style={styles.cmdActions}>
        {state.status !== "idle" && state.status !== "sending" && (
          <Feather name={statusIcon as any} size={14} color={statusColor} />
        )}
        <TouchableOpacity
          style={[styles.sendBtn, {
            backgroundColor: state.status === "sending" ? "#FFB80030" : catColor + "20",
            borderColor: state.status === "sending" ? "#FFB800" : catColor,
            opacity: isConnected ? 1 : 0.4,
          }]}
          onPress={() => onSend(index, state.editedCmd)}
          disabled={!isConnected || state.status === "sending"}
          activeOpacity={0.7}
        >
          {state.status === "sending"
            ? <ActivityIndicator size="small" color="#FFB800" />
            : <Text style={[styles.sendBtnText, { color: catColor }]}>SEND</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Command sheet (bottom panel) ──────────────────────────────────────────────
interface CommandSheetProps {
  reset: ServiceReset;
  onClose: () => void;
  isConnected: boolean;
  sendRawCommand: (cmd: string, timeout?: number) => Promise<string>;
}

function CommandSheet({ reset, onClose, isConnected, sendRawCommand }: CommandSheetProps) {
  const colors = useColors();
  const catColor = CATEGORY_COLORS[reset.category] ?? colors.primary;

  const initStates = (): CmdState[] =>
    reset.obdCommands.map((c) => ({
      status: "idle",
      response: "",
      editedCmd: c.cmd,
      editing: false,
    }));

  const [cmdStates, setCmdStates] = useState<CmdState[]>(initStates);
  const [runningAll, setRunningAll] = useState(false);
  const [activeTab, setActiveTab] = useState<"commands" | "procedure">("commands");
  const stopRef = useRef(false);

  const updateState = (index: number, patch: Partial<CmdState>) =>
    setCmdStates((prev) => prev.map((s, i) => i === index ? { ...s, ...patch } : s));

  const sendOne = async (index: number, cmd: string) => {
    const step = reset.obdCommands[index];
    updateState(index, { status: "sending", response: "", editedCmd: cmd });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const raw = await sendRawCommand(cmd, step.timeoutMs ?? 3000);
      const failed = raw.includes("ERROR") || raw.includes("NO DATA") ||
        raw.includes("NR") || raw.includes("?") ||
        /7F\s*\w{2}\s*(22|24|25|33|35)/i.test(raw);
      updateState(index, {
        status: failed ? "error" : "ok",
        response: raw.trim().slice(0, 60),
      });
      if (!failed) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e: any) {
      updateState(index, { status: "error", response: e?.message ?? "Timeout" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const runAll = async () => {
    if (reset.dangerous) {
      await new Promise<void>((resolve, reject) =>
        Alert.alert(
          "Confirm Procedure",
          reset.warning ?? "This procedure may affect vehicle operation. Proceed?",
          [
            { text: "Cancel", style: "cancel", onPress: () => reject() },
            { text: "Proceed", style: "destructive", onPress: () => resolve() },
          ]
        )
      ).catch(() => null);
    }

    stopRef.current = false;
    setRunningAll(true);
    setCmdStates(initStates());

    for (let i = 0; i < reset.obdCommands.length; i++) {
      if (stopRef.current) {
        // Mark remaining as skipped
        setCmdStates((prev) =>
          prev.map((s, idx) => idx >= i ? { ...s, status: "skipped" } : s)
        );
        break;
      }
      await sendOne(i, cmdStates[i]?.editedCmd ?? reset.obdCommands[i].cmd);
      // Small gap between commands
      await new Promise((r) => setTimeout(r, 200));
    }
    setRunningAll(false);
  };

  const resetAll = () => {
    stopRef.current = true;
    setCmdStates(initStates());
    setRunningAll(false);
  };

  const successCount = cmdStates.filter((s) => s.status === "ok").length;
  const errorCount = cmdStates.filter((s) => s.status === "error").length;
  const allDone = cmdStates.every((s) => s.status !== "idle" && s.status !== "sending");

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

      {/* Header */}
      <View style={styles.sheetHeader}>
        <View style={[styles.sheetIconBg, { backgroundColor: catColor + "20" }]}>
          <Feather name={reset.icon as any} size={18} color={catColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{reset.name}</Text>
          <Text style={[styles.sheetSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {reset.description}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Warning */}
      {reset.warning && (
        <View style={[styles.warningBanner, { backgroundColor: "#FFB80015", borderColor: "#FFB800" }]}>
          <Feather name="alert-triangle" size={12} color="#FFB800" />
          <Text style={styles.warningText}>{reset.warning}</Text>
        </View>
      )}

      {/* Tab switcher */}
      <View style={[styles.tabRow, { borderColor: colors.border }]}>
        {(["commands", "procedure"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && { borderBottomColor: catColor, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === tab ? catColor : colors.mutedForeground }]}>
              {tab === "commands" ? `OBD COMMANDS (${reset.obdCommands.length})` : "PROCEDURE"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Commands tab */}
      {activeTab === "commands" && (
        <>
          {/* Progress bar */}
          {(successCount > 0 || errorCount > 0) && (
            <View style={[styles.progressBar, { backgroundColor: colors.secondary }]}>
              <View style={[styles.progressFill, {
                width: `${(successCount / reset.obdCommands.length) * 100}%`,
                backgroundColor: errorCount > 0 ? "#FF4444" : "#00E87A",
              }]} />
              <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                {successCount}/{reset.obdCommands.length} OK
                {errorCount > 0 ? ` · ${errorCount} ERR` : ""}
              </Text>
            </View>
          )}

          {!isConnected && (
            <View style={[styles.notConnectedBanner, { backgroundColor: "#FFB80015", borderColor: "#FFB800" }]}>
              <Feather name="bluetooth-off" size={12} color="#FFB800" />
              <Text style={[styles.notConnectedText, { color: "#FFB800" }]}>
                Connect to ELM327 adapter to send commands
              </Text>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 10, gap: 6, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {reset.obdCommands.map((step, i) => (
              <CommandRow
                key={i}
                step={step}
                index={i}
                state={cmdStates[i]}
                catColor={catColor}
                isConnected={isConnected}
                onSend={sendOne}
                onEdit={(idx, val) => updateState(idx, { editedCmd: val })}
                onToggleEdit={(idx) => updateState(idx, { editing: !cmdStates[idx].editing })}
              />
            ))}
          </ScrollView>

          {/* Run all / Stop / Reset buttons */}
          <View style={[styles.bottomBtns, { borderTopColor: colors.border }]}>
            {allDone ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={resetAll}
              >
                <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>RESET</Text>
              </TouchableOpacity>
            ) : runningAll ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#FF444415", borderColor: "#FF4444" }]}
                onPress={() => { stopRef.current = true; setRunningAll(false); }}
              >
                <Feather name="square" size={14} color="#FF4444" />
                <Text style={[styles.actionBtnText, { color: "#FF4444" }]}>STOP</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: catColor, opacity: isConnected ? 1 : 0.4 }]}
                onPress={runAll}
                disabled={!isConnected || runningAll}
              >
                <Feather name="play" size={14} color="#000" />
                <Text style={[styles.actionBtnText, { color: "#000" }]}>RUN ALL COMMANDS</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Procedure tab */}
      {activeTab === "procedure" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {reset.requiresEngineOn && (
            <View style={[styles.conditionCard, { backgroundColor: "#00E87A15", borderColor: "#00E87A" }]}>
              <Feather name="check-circle" size={13} color="#00E87A" />
              <Text style={[styles.conditionCardText, { color: "#00E87A" }]}>Requires engine RUNNING</Text>
            </View>
          )}
          {reset.requiresEngineOff && (
            <View style={[styles.conditionCard, { backgroundColor: "#FF444415", borderColor: "#FF4444" }]}>
              <Feather name="power" size={13} color="#FF4444" />
              <Text style={[styles.conditionCardText, { color: "#FF4444" }]}>Requires engine OFF, ignition ON</Text>
            </View>
          )}
          {(reset.steps ?? []).map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: catColor + "30" }]}>
                <Text style={[styles.stepNumText, { color: catColor }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: catColor, marginTop: 8, opacity: isConnected ? 1 : 0.4 }]}
            onPress={() => { setActiveTab("commands"); runAll(); }}
            disabled={!isConnected}
          >
            <Feather name="play" size={14} color="#000" />
            <Text style={[styles.actionBtnText, { color: "#000" }]}>START PROCEDURE</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ServiceScreen() {
  const colors = useColors();
  const { connectionStatus, sendRawCommand } = useOBD2();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeReset, setActiveReset] = useState<ServiceReset | null>(null);

  const isConnected = connectionStatus === "CONNECTED";

  const filtered = selectedCategory === "All"
    ? SERVICE_RESETS
    : SERVICE_RESETS.filter((r) => r.category === selectedCategory);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ConnectionBar />

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {["All", ...SERVICE_CATEGORIES].map((cat) => {
          const isSelected = cat === selectedCategory;
          const catColor = CATEGORY_COLORS[cat] ?? colors.primary;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, {
                backgroundColor: isSelected ? catColor + "20" : colors.card,
                borderColor: isSelected ? catColor : colors.border,
              }]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.7}
            >
              {cat !== "All" && (
                <Feather
                  name={(CATEGORY_ICONS[cat] ?? "circle") as any}
                  size={11}
                  color={isSelected ? catColor : colors.mutedForeground}
                />
              )}
              <Text style={[styles.catText, { color: isSelected ? catColor : colors.mutedForeground }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Not connected banner */}
      {!isConnected && (
        <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 12, marginBottom: 4 }]}>
          <Feather name="info" size={13} color={colors.mutedForeground} />
          <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
            Connect to ELM327 to send real OBD2 commands — or use Demo mode to preview
          </Text>
        </View>
      )}

      {/* Service reset list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const catColor = CATEGORY_COLORS[item.category] ?? colors.primary;
          return (
            <TouchableOpacity
              style={[styles.resetCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: catColor }]}
              onPress={() => setActiveReset(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.resetIcon, { backgroundColor: catColor + "20" }]}>
                <Feather name={item.icon as any} size={16} color={catColor} />
              </View>
              <View style={styles.resetInfo}>
                <View style={styles.resetNameRow}>
                  <Text style={[styles.resetName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.dangerous && (
                    <View style={[styles.dangerBadge, { backgroundColor: "#FFB80020" }]}>
                      <Feather name="alert-triangle" size={9} color="#FFB800" />
                    </View>
                  )}
                </View>
                <Text style={[styles.resetDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.description}
                </Text>
                <View style={styles.resetMeta}>
                  <Text style={[styles.resetCat, { color: catColor + "CC" }]}>{item.category}</Text>
                  <View style={[styles.cmdCountBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="console-line" size={9} color={colors.mutedForeground} />
                    <Text style={[styles.cmdCountText, { color: colors.mutedForeground }]}>
                      {item.obdCommands.length} cmd{item.obdCommands.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  {item.requiresEngineOn && (
                    <View style={[styles.condBadge, { backgroundColor: "#00E87A15" }]}>
                      <Text style={[styles.condText, { color: "#00E87A" }]}>Engine ON</Text>
                    </View>
                  )}
                  {item.requiresEngineOff && (
                    <View style={[styles.condBadge, { backgroundColor: "#FF444415" }]}>
                      <Text style={[styles.condText, { color: "#FF4444" }]}>Engine OFF</Text>
                    </View>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      />

      {/* Command sheet overlay */}
      {activeReset && (
        <View style={[styles.overlay, { backgroundColor: "#000000BB" }]}>
          <TouchableOpacity style={styles.overlayDismiss} onPress={() => setActiveReset(null)} />
          <CommandSheet
            reset={activeReset}
            onClose={() => setActiveReset(null)}
            isConnected={isConnected}
            sendRawCommand={sendRawCommand}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  categories: { paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  catText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  banner: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  bannerText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  list: { padding: 12, paddingTop: 4 },
  resetCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderLeftWidth: 3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 7, gap: 10 },
  resetIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  resetInfo: { flex: 1, gap: 3 },
  resetNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  resetName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dangerBadge: { padding: 3, borderRadius: 4 },
  resetDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  resetMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2, flexWrap: "wrap" },
  resetCat: { fontSize: 10, fontFamily: "Inter_500Medium" },
  cmdCountBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  cmdCountText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  condBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  condText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  overlayDismiss: { flex: 1 },

  // Sheet
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: "85%", flex: 0, minHeight: 500 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", margin: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
  sheetIconBg: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sheetSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  warningBanner: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderWidth: 1, borderRadius: 8, padding: 9, marginHorizontal: 14, marginBottom: 6 },
  warningText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#FFB800", flex: 1, lineHeight: 15 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 14 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabBtnText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },

  // Progress
  progressBar: { marginHorizontal: 10, marginTop: 8, borderRadius: 6, height: 24, overflow: "hidden", justifyContent: "center" },
  progressFill: { position: "absolute", top: 0, left: 0, bottom: 0, borderRadius: 6 },
  progressText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center", letterSpacing: 0.3 },
  notConnectedBanner: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginHorizontal: 10, marginTop: 6 },
  notConnectedText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Command rows
  cmdRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderLeftWidth: 3, borderRadius: 9, padding: 10 },
  cmdIndex: { width: 22, height: 22, borderRadius: 5, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  cmdIndexText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  cmdDesc: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 14 },
  cmdCode: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 },
  cmdCodeText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  cmdInput: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  responseRow: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4 },
  responseText: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  timeoutBadge: { fontSize: 9, fontFamily: "Inter_400Regular" },
  cmdActions: { alignItems: "center", gap: 5, flexShrink: 0 },
  sendBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5, minWidth: 50, alignItems: "center", justifyContent: "center" },
  sendBtnText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  // Bottom buttons
  bottomBtns: { borderTopWidth: 1, padding: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 13 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 },

  // Procedure tab
  conditionCard: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 8, padding: 9 },
  conditionCardText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, paddingTop: 2 },
});
