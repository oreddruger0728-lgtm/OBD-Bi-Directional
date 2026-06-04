import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { useOBD2 } from "@/contexts/OBD2Context";
import { BIDI_COMMANDS, CATEGORIES, type BiDiCommand } from "@/utils/bidirectionalCommands";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<string, string> = {
  Cooling: "wind",
  "Fuel System": "droplet",
  Emissions: "cloud",
  Ignition: "zap",
  Transmission: "settings",
  HVAC: "thermometer",
  Suspension: "disc",
  Injection: "activity",
};

export default function BiDirectionalScreen() {
  const colors = useColors();
  const { runActuatorTest, activeTest, testResult, connectionStatus } = useOBD2();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const isConnected = connectionStatus === "CONNECTED";

  const allCategories = ["All", ...CATEGORIES];
  const filtered =
    selectedCategory === "All"
      ? BIDI_COMMANDS
      : BIDI_COMMANDS.filter((c) => c.category === selectedCategory);

  const handleRun = (cmd: BiDiCommand) => {
    if (!isConnected) return;
    if (cmd.dangerous) {
      Alert.alert(
        "Warning",
        `${cmd.name}\n\n${cmd.description}\n\nThis test may affect vehicle operation. Only run with engine running in a safe location.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Run Test",
            style: "destructive",
            onPress: async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await runActuatorTest(cmd.id, cmd.command);
            },
          },
        ]
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      runActuatorTest(cmd.id, cmd.command);
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
        {allCategories.map((cat) => {
          const isSelected = cat === selectedCategory;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.7}
            >
              {cat !== "All" && (
                <Feather
                  name={CATEGORY_ICONS[cat] as any || "circle"}
                  size={11}
                  color={isSelected ? colors.primaryForeground : colors.mutedForeground}
                />
              )}
              <Text
                style={[
                  styles.catText,
                  { color: isSelected ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!isConnected && (
        <View style={[styles.notConnectedBanner, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 12 }]}>
          <Feather name="bluetooth" size={14} color={colors.mutedForeground} />
          <Text style={[styles.notConnectedText, { color: colors.mutedForeground }]}>
            Connect to ELM327 to run actuator tests
          </Text>
        </View>
      )}

      {testResult && (
        <View
          style={[
            styles.resultBanner,
            {
              backgroundColor: testResult.startsWith("OK") ? "#00E87A20" : "#FF444420",
              borderColor: testResult.startsWith("OK") ? "#00E87A" : "#FF4444",
              marginHorizontal: 12,
            },
          ]}
        >
          <Feather
            name={testResult.startsWith("OK") ? "check-circle" : "x-circle"}
            size={14}
            color={testResult.startsWith("OK") ? "#00E87A" : "#FF4444"}
          />
          <Text
            style={[
              styles.resultText,
              { color: testResult.startsWith("OK") ? "#00E87A" : "#FF4444" },
            ]}
          >
            {testResult}
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isRunning = activeTest === item.id;
          return (
            <View
              style={[
                styles.cmdCard,
                {
                  backgroundColor: isRunning ? colors.primary + "15" : colors.card,
                  borderColor: isRunning ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.cmdLeft}>
                <View style={[styles.cmdIcon, { backgroundColor: colors.secondary }]}>
                  <Feather
                    name={CATEGORY_ICONS[item.category] as any || "circle"}
                    size={14}
                    color={isRunning ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View style={styles.cmdInfo}>
                  <View style={styles.cmdNameRow}>
                    <Text style={[styles.cmdName, { color: colors.foreground }]}>{item.name}</Text>
                    {item.dangerous && (
                      <View style={[styles.dangerBadge, { backgroundColor: "#FF444420" }]}>
                        <Text style={styles.dangerText}>!</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cmdDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={[styles.cmdCategory, { color: colors.primary + "99" }]}>
                    {item.category}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.runBtn,
                  {
                    backgroundColor: isRunning ? colors.primary + "30" : colors.primary + "20",
                    borderColor: isRunning ? colors.primary : colors.primary + "50",
                    opacity: isConnected && !activeTest ? 1 : 0.35,
                  },
                ]}
                onPress={() => handleRun(item)}
                disabled={!isConnected || !!activeTest}
                activeOpacity={0.7}
              >
                {isRunning ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <Feather name="play" size={12} color={colors.primary} />
                    <Text style={[styles.runBtnText, { color: colors.primary }]}>RUN</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  categories: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  catText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  notConnectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  notConnectedText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    padding: 12,
    paddingTop: 4,
  },
  cmdCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 7,
    gap: 10,
  },
  cmdLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cmdIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cmdInfo: {
    flex: 1,
    gap: 1,
  },
  cmdNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cmdName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  dangerBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#FF4444",
  },
  cmdDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  cmdCategory: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
    marginTop: 1,
  },
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 52,
    justifyContent: "center",
  },
  runBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});
