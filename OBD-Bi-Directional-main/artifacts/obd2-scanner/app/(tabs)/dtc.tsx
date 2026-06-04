import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { DTCItem } from "@/components/DTCItem";
import { useOBD2 } from "@/contexts/OBD2Context";
import { useColors } from "@/hooks/useColors";
import { VEHICLE_MODULES } from "@/utils/modules";

type ScanMode = "standard" | "modules";

export default function DTCScreen() {
  const colors = useColors();
  const {
    dtcList, pendingDTCCount, refreshDTCs, clearDTCs,
    moduleDTCs, scanAllModules, clearModuleDTCs,
    connectionStatus, isScanning, isModuleScanning,
    dtcFreezeFrames, fetchingFreezeFrames, fetchFreezeFrame,
  } = useOBD2();
  const insets = useSafeAreaInsets();
  const isConnected = connectionStatus === "CONNECTED";
  const [scanMode, setScanMode] = useState<ScanMode>("modules");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");

  const totalModuleDTCs = moduleDTCs.reduce((acc, m) => acc + m.dtcs.length, 0);
  const allDTCs = [...dtcList, ...moduleDTCs.flatMap((m) => m.dtcs)];
  const criticalCount = allDTCs.filter((d) => d.severity === "critical").length;
  const warningCount = allDTCs.filter((d) => d.severity === "warning").length;

  const selectedModuleDTCs = selectedModule === "ALL"
    ? moduleDTCs.flatMap((m) => m.dtcs)
    : moduleDTCs.find((m) => m.module.id === selectedModule)?.dtcs ?? [];

  const displayList = scanMode === "standard" ? dtcList : selectedModuleDTCs;
  const totalCount = scanMode === "standard" ? dtcList.length : totalModuleDTCs;

  const handleClear = () => {
    Alert.alert(
      "Clear All DTCs",
      "This will erase ALL stored fault codes across all modules and reset all MIL indicators. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            if (scanMode === "standard") await clearDTCs();
            else await clearModuleDTCs();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleScan = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (scanMode === "standard") await refreshDTCs();
    else await scanAllModules();
  };

  const isCurrentlyScanning = scanMode === "standard" ? isScanning : isModuleScanning;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ConnectionBar />

      {/* Mode toggle */}
      <View style={[styles.modeToggle, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.modeBtn, scanMode === "standard" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setScanMode("standard")}
        >
          <Text style={[styles.modeBtnText, { color: scanMode === "standard" ? colors.primary : colors.mutedForeground }]}>
            OBD2 / ECM
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, scanMode === "modules" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setScanMode("modules")}
        >
          <View style={styles.modeBtnInner}>
            <Text style={[styles.modeBtnText, { color: scanMode === "modules" ? colors.primary : colors.mutedForeground }]}>
              ALL MODULES
            </Text>
            <View style={[styles.modeBadge, { backgroundColor: "#00D4FF20" }]}>
              <Text style={[styles.modeBadgeText, { color: colors.primary }]}>ADV</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      {(totalCount > 0 || (moduleDTCs.length > 0 && scanMode === "modules")) && (
        <View style={[styles.summary, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#FF4444" }]}>{criticalCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>CRITICAL</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#FFB800" }]}>{warningCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>WARNING</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.foreground }]}>{totalCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>TOTAL</Text>
          </View>
          {scanMode === "modules" && (
            <>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: "#00E87A" }]}>{moduleDTCs.filter((m) => m.scanned).length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>MODULES</Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Module chips */}
      {scanMode === "modules" && moduleDTCs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleChips}>
          <TouchableOpacity
            style={[styles.moduleChip, { backgroundColor: selectedModule === "ALL" ? colors.primary + "20" : colors.card, borderColor: selectedModule === "ALL" ? colors.primary : colors.border }]}
            onPress={() => setSelectedModule("ALL")}
          >
            <Text style={[styles.moduleChipText, { color: selectedModule === "ALL" ? colors.primary : colors.mutedForeground }]}>
              All ({totalModuleDTCs})
            </Text>
          </TouchableOpacity>
          {moduleDTCs.filter((m) => m.scanned).map((m) => (
            <TouchableOpacity
              key={m.module.id}
              style={[styles.moduleChip, { backgroundColor: selectedModule === m.module.id ? m.module.color + "20" : colors.card, borderColor: selectedModule === m.module.id ? m.module.color : colors.border }]}
              onPress={() => setSelectedModule(m.module.id)}
            >
              {m.scanning && <ActivityIndicator size="small" color={m.module.color} />}
              <Text style={[styles.moduleChipText, { color: selectedModule === m.module.id ? m.module.color : colors.mutedForeground }]}>
                {m.module.shortName}{m.dtcs.length > 0 && ` (${m.dtcs.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Scan progress dots */}
      {scanMode === "modules" && isModuleScanning && (
        <View style={[styles.scanProgress, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {moduleDTCs.map((m) => (
            <View key={m.module.id} style={[styles.progressDot, {
              backgroundColor: m.scanning ? "#FFB800" : m.scanned ? (m.dtcs.length > 0 ? "#FF4444" : "#00E87A") : colors.border,
            }]} />
          ))}
          <Text style={[styles.scanProgressText, { color: colors.mutedForeground }]}>
            Scanning {moduleDTCs.filter((m) => m.scanned).length}/{moduleDTCs.length} modules...
          </Text>
        </View>
      )}

      {/* DTC list — each item has expandable freeze frame */}
      <FlatList
        data={displayList}
        keyExtractor={(item, i) => `${item.code}-${i}`}
        renderItem={({ item }) => (
          <DTCItem
            entry={item}
            freezeFrame={dtcFreezeFrames[item.code] ?? null}
            isFetchingFreezeFrame={fetchingFreezeFrames[item.code] ?? false}
            onFetchFreezeFrame={isConnected ? () => fetchFreezeFrame(item.code) : undefined}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={!!displayList.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            {isCurrentlyScanning ? (
              <>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {scanMode === "modules" ? "Scanning all modules..." : "Scanning for fault codes..."}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  {scanMode === "modules" ? "Querying ECM, TCM, BCM, ABS, SRS, HVAC..." : "Querying powertrain module"}
                </Text>
              </>
            ) : (
              <>
                <Feather name="check-circle" size={44} color={colors.success} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {isConnected ? "No fault codes found" : "Not connected"}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  {isConnected
                    ? scanMode === "modules"
                      ? "Tap SCAN ALL to query every module"
                      : "Tap SCAN DTCs to query ECM"
                    : "Connect to ELM327 to begin diagnostics"}
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.toolBtn, { borderColor: colors.primary, opacity: isConnected && !isCurrentlyScanning ? 1 : 0.4 }]}
          onPress={handleScan}
          disabled={!isConnected || isCurrentlyScanning}
          activeOpacity={0.7}
        >
          {isCurrentlyScanning
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Feather name="search" size={15} color={colors.primary} />}
          <Text style={[styles.toolBtnText, { color: colors.primary }]}>
            {isCurrentlyScanning ? "SCANNING..." : scanMode === "modules" ? "SCAN ALL" : "SCAN DTCs"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, { borderColor: "#FF4444", opacity: isConnected && !isCurrentlyScanning && totalCount > 0 ? 1 : 0.3 }]}
          onPress={handleClear}
          disabled={!isConnected || isCurrentlyScanning || totalCount === 0}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={15} color="#FF4444" />
          <Text style={[styles.toolBtnText, { color: "#FF4444" }]}>CLEAR ALL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modeToggle: { flexDirection: "row", borderBottomWidth: 1 },
  modeBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  modeBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  modeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  modeBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  modeBadgeText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  summary: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1 },
  summaryNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.8, marginTop: 1 },
  moduleChips: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  moduleChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  moduleChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  scanProgress: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 5, borderBottomWidth: 1 },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  scanProgressText: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  list: { padding: 12 },
  empty: { alignItems: "center", paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32, lineHeight: 18 },
  toolbar: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  toolBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingVertical: 10 },
  toolBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
});
