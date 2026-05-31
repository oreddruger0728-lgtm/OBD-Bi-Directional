import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useOBD2 } from "@/contexts/OBD2Context";

export function ConnectionBar() {
  const colors = useColors();
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
        : "CONNECTED"
      : connectionStatus === "CONNECTING"
      ? "CONNECTING..."
      : connectionStatus === "ERROR"
      ? "CONNECTION FAILED"
      : "DISCONNECTED";

  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={styles.left}
        onPress={() => router.push("/connect")}
        activeOpacity={0.7}
      >
        <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: pulseAnim }]} />
        <Text style={[styles.status, { color: isConnected ? dotColor : colors.mutedForeground }]}>
          {statusText}
        </Text>
        {isConnected && (
          <View style={[styles.modeBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.modeText, { color: colors.mutedForeground }]}>ELM327</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, { borderColor: isConnected ? "#FF4444" : colors.primary }]}
        onPress={() => {
          if (isConnected) disconnect();
          else router.push("/connect");
        }}
        activeOpacity={0.7}
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
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
