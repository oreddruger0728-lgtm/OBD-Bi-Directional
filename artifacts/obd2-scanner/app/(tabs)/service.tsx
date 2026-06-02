import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, FlatList,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { useOBD2 } from "@/contexts/OBD2Context";
import { SERVICE_CATEGORIES, SERVICE_RESETS, type ServiceReset } from "@/utils/serviceResets";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<string, string> = {
  Engine: "activity",
  Transmission: "git-branch",
  Brakes: "disc",
  Steering: "navigation",
  Tires: "circle",
  Body: "square",
  HVAC: "thermometer",
  Battery: "battery-charging",
};

const CATEGORY_COLORS: Record<string, string> = {
  Engine: "#00D4FF",
  Transmission: "#A78BFA",
  Brakes: "#FF6B6B",
  Steering: "#34D399",
  Tires: "#FCD34D",
  Body: "#94A3B8",
  HVAC: "#60A5FA",
  Battery: "#F59E0B",
};

interface StepSheetProps {
  reset: ServiceReset;
  onClose: () => void;
  onRun: () => void;
  isRunning: boolean;
  result: { success: boolean; message: string } | null;
}

function StepSheet({ reset, onClose, onRun, isRunning, result }: StepSheetProps) {
  const colors = useColors();
  const catColor = CATEGORY_COLORS[reset.category] ?? colors.primary;

  return (
    <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
      <View style={styles.sheetHeader}>
        <View style={[styles.sheetIconBg, { backgroundColor: catColor + "20" }]}>
          <Feather name={reset.icon as any} size={18} color={catColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{reset.name}</Text>
          <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>{reset.description}</Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {reset.warning && (
        <View style={[styles.warningBanner, { backgroundColor: "#FFB80015", borderColor: "#FFB800" }]}>
          <Feather name="alert-triangle" size={13} color="#FFB800" />
          <Text style={styles.warningText}>{reset.warning}</Text>
        </View>
      )}

      {reset.steps && (
        <View style={styles.stepsList}>
          <Text style={[styles.stepsTitle, { color: colors.mutedForeground }]}>PROCEDURE</Text>
          {reset.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: catColor + "30" }]}>
                <Text style={[styles.stepNumText, { color: catColor }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {result && (
        <View style={[styles.resultBox, {
          backgroundColor: result.success ? "#00E87A15" : "#FF444415",
          borderColor: result.success ? "#00E87A" : "#FF4444",
        }]}>
          <Feather name={result.success ? "check-circle" : "x-circle"} size={14} color={result.success ? "#00E87A" : "#FF4444"} />
          <Text style={[styles.resultMsg, { color: result.success ? "#00E87A" : "#FF4444" }]}>
            {result.message}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.runSheetBtn, { backgroundColor: catColor, opacity: isRunning ? 0.7 : 1 }]}
        onPress={onRun}
        disabled={isRunning}
        activeOpacity={0.8}
      >
        {isRunning ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Feather name="play" size={16} color="#000" />
            <Text style={styles.runSheetBtnText}>
              {result ? "RUN AGAIN" : "RUN PROCEDURE"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ServiceScreen() {
  const colors = useColors();
  const { runServiceReset, connectionStatus } = useOBD2();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeReset, setActiveReset] = useState<ServiceReset | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const isConnected = connectionStatus === "CONNECTED";

  const filtered = selectedCategory === "All"
    ? SERVICE_RESETS
    : SERVICE_RESETS.filter((r) => r.category === selectedCategory);

  const handleOpenReset = (reset: ServiceReset) => {
    setActiveReset(reset);
    setResult(null);
  };

  const handleRunReset = async () => {
    if (!activeReset) return;
    if (activeReset.dangerous) {
      Alert.alert(
        "Confirm Procedure",
        activeReset.warning ?? "This procedure may affect vehicle operation. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Proceed",
            style: "destructive",
            onPress: async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              doRun();
            },
          },
        ]
      );
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      doRun();
    }
  };

  const doRun = async () => {
    if (!activeReset) return;
    setIsRunning(true);
    const res = await runServiceReset(activeReset.id);
    setResult(res);
    setIsRunning(false);
    if (res.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ConnectionBar />

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
                <Feather name={CATEGORY_ICONS[cat] as any || "circle"} size={11} color={isSelected ? catColor : colors.mutedForeground} />
              )}
              <Text style={[styles.catText, { color: isSelected ? catColor : colors.mutedForeground }]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!isConnected && (
        <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 12, marginBottom: 4 }]}>
          <Feather name="info" size={13} color={colors.mutedForeground} />
          <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
            Connect in Demo mode to preview all service procedures
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const catColor = CATEGORY_COLORS[item.category] ?? colors.primary;
          return (
            <TouchableOpacity
              style={[styles.resetCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: catColor }]}
              onPress={() => handleOpenReset(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.resetIcon, { backgroundColor: catColor + "20" }]}>
                <Feather name={item.icon as any} size={16} color={catColor} />
              </View>
              <View style={styles.resetInfo}>
                <View style={styles.resetNameRow}>
                  <Text style={[styles.resetName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.dangerous && (
                    <View style={[styles.dangerDot, { backgroundColor: "#FFB80030" }]}>
                      <Feather name="alert-triangle" size={9} color="#FFB800" />
                    </View>
                  )}
                </View>
                <Text style={[styles.resetDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.description}
                </Text>
                <View style={styles.resetMeta}>
                  <Text style={[styles.resetCategory, { color: catColor + "CC" }]}>{item.category}</Text>
                  {item.requiresEngineOn && (
                    <View style={[styles.conditionBadge, { backgroundColor: "#00E87A15" }]}>
                      <Text style={[styles.conditionText, { color: "#00E87A" }]}>Engine ON</Text>
                    </View>
                  )}
                  {item.requiresEngineOff && (
                    <View style={[styles.conditionBadge, { backgroundColor: "#FF444415" }]}>
                      <Text style={[styles.conditionText, { color: "#FF4444" }]}>Engine OFF</Text>
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

      {activeReset && (
        <View style={[styles.overlay, { backgroundColor: "#000000BB" }]}>
          <TouchableOpacity style={styles.overlayDismiss} onPress={() => { setActiveReset(null); setResult(null); }} />
          <StepSheet
            reset={activeReset}
            onClose={() => { setActiveReset(null); setResult(null); }}
            onRun={handleRunReset}
            isRunning={isRunning}
            result={result}
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
  dangerDot: { padding: 3, borderRadius: 4 },
  resetDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  resetMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  resetCategory: { fontSize: 10, fontFamily: "Inter_500Medium" },
  conditionBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  conditionText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  overlayDismiss: { flex: 1 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, paddingBottom: 36, gap: 14 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sheetIconBg: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sheetDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  warningBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  warningText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#FFB800", flex: 1, lineHeight: 16 },
  stepsList: { gap: 6 },
  stepsTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 2 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, paddingTop: 2 },
  resultBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  resultMsg: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  runSheetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  runSheetBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000", letterSpacing: 1 },
});
