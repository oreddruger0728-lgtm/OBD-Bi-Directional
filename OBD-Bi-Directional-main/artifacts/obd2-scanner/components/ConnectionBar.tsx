import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useOBD2 } from "@/contexts/OBD2Context";

export function ConnectionBar() {
  const colors = useColors();
  // ── FIX 1: read the safe-area top inset so the bar sits BELOW the
  //           status bar / dynamic island instead of behind it.
  const insets = useSafeAreaInsets();
  const { connectionStatus, connectionMode, disconnect } = useOBD2();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isConnected = connectionStatus === "CONNECTED";
  const isConnecting = connectionStatus === "CONNECTING";

  useEffect(() => {
    if (isConnecting) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnecting, pulseAnim]);

  const dotColor =
    connectionStatus === "CONNECTED"
      ? "#00E87A"
      : connectionStatus === "CONNECTING"
      ? "#FFB800"
      : connectionStatus === "ERROR"
      ? "#FF4444"
      : colors.border;

  const statusText =
    connectionStatus === "CONNECTED"
      ? connectionMode === "DEMO"
        ? "DEMO MODE"
        : connectionMode === "WIFI"
        ? "WIFI CONNECTED"
        : "BT CONNECTED"
      : connectionStatus === "CONNECTING"
      ? "CONNECTING..."
      : connectionStatus === "ERROR"
      ? "CONNECTION FAILED"
      : "DISCONNECTED";

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          // ── FIX 1: push bar content below status bar / notch
          paddingTop: insets.top + 6,
        },
      ]}
    >
      {/* Left — tap to open connect screen */}
      <TouchableOpacity
        style={styles.left}
        onPress={() => router.push("/connect")}
        activeOpacity={0.7}
        // ── FIX 2: generous hit area so the small status dot/text is easy to tap
        hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
      >
        <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: pulseAnim }]} />
        <Text style={[styles.status, { color: isConnected ? dotColor : colors.mutedForeground }]}>
          {statusText}
        </Text>
        {isConnected && (
          <View style={[styles.modeBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.modeText, { color: colors.mutedForeground }]}>
              {connectionMode}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.rightRow}>
        {/* Settings button */}
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: colors.border }]}
          onPress={() => router.push("/settings")}
          activeOpacity={0.7}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="cog-outline" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Connect / Disconnect */}
        <TouchableOpacity
          style={[styles.btn, { borderColor: isConnected ? "#FF4444" : colors.primary }]}
          onPress={() => {
            if (isConnected) disconnect();
            else router.push("/connect");
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 16 }}
        >
          <MaterialCommunityIcons
            name={isConnected ? "bluetooth-off" : "bluetooth-connect"}
            size={16}
            color={isConnected ? "#FF4444" : colors.primary}
          />
          <Text style={[styles.btnText, { color: isConnected ? "#FF4444" : colors.primary }]}>
            {isConnected ? "DISCONNECT" : "CONNECT"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeText: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
