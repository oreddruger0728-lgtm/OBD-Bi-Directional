import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { GaugeCard } from "@/components/GaugeCard";
import { SweepGauge } from "@/components/SweepGauge";
import { useOBD2 } from "@/contexts/OBD2Context";
import { useColors } from "@/hooks/useColors";

export default function DashboardScreen() {
  const colors = useColors();
  const { liveData, connectionStatus } = useOBD2();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isConnected = connectionStatus === "CONNECTED";
  const hasData = connectionStatus === "CONNECTED";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ConnectionBar />
      <TouchableOpacity
        style={[styles.graphBanner, { backgroundColor: colors.card, borderColor: hasData ? "#00D4FF30" : colors.border }]}
        onPress={() => router.push("/graph")}
        activeOpacity={0.75}
      >
        <View style={styles.graphBannerLeft}>
          <View style={[styles.graphDot, { backgroundColor: "#00D4FF", opacity: hasData ? 1 : 0.3 }]} />
          <View style={[styles.graphDot, { backgroundColor: "#00E87A", opacity: hasData ? 1 : 0.3 }]} />
          <View style={[styles.graphDot, { backgroundColor: "#FFB800", opacity: hasData ? 1 : 0.3 }]} />
        </View>
        <Text style={[styles.graphBannerText, { color: colors.foreground }]}>Live Graph</Text>
        <Text style={[styles.graphBannerSub, { color: colors.mutedForeground }]}>
          {hasData ? "Plotting live sensor data" : "Connect to start graphing"}
        </Text>
        <Feather name="trending-up" size={16} color={hasData ? "#00D4FF" : colors.mutedForeground} style={{ marginLeft: "auto" }} />
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: insets.bottom + 90,
            paddingTop: 12,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isConnected && (
          <View style={[styles.disconnectedBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.disconnectedText, { color: colors.mutedForeground }]}>
              Not connected — tap CONNECT to link your ELM327 adapter
            </Text>
          </View>
        )}

        <View style={styles.sweepRow}>
          <SweepGauge
            label="Engine RPM"
            value={liveData.rpm}
            unit="RPM"
            min={0}
            max={8000}
            color={colors.rpm}
            size={168}
            warningHigh={6000}
            criticalHigh={7500}
            ticks={[0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]}
          />
          <SweepGauge
            label="Speed"
            value={liveData.speed}
            unit="km/h"
            min={0}
            max={240}
            color={colors.speed}
            size={168}
            ticks={[0, 40, 80, 120, 160, 200, 240]}
          />
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <GaugeCard
              label="Coolant"
              value={liveData.coolantTemp}
              unit="°C"
              color={colors.temp}
              warningHigh={100}
              criticalHigh={110}
            />
          </View>
          <View style={styles.col}>
            <GaugeCard
              label="Throttle"
              value={liveData.throttle}
              unit="%"
              color={colors.throttle}
              decimals={1}
            />
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <GaugeCard
              label="Engine Load"
              value={liveData.engineLoad}
              unit="%"
              color={colors.load}
              decimals={1}
              warningHigh={85}
            />
          </View>
          <View style={styles.col}>
            <GaugeCard
              label="Fuel Level"
              value={liveData.fuelLevel}
              unit="%"
              color={colors.fuel}
              warningLow={15}
            />
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <GaugeCard
              label="Battery"
              value={liveData.batteryVoltage}
              unit="V"
              color={colors.voltage}
              decimals={1}
              warningLow={12.0}
              criticalHigh={15.5}
            />
          </View>
          <View style={styles.col}>
            <GaugeCard
              label="Oil Temp"
              value={liveData.oilTemp}
              unit="°C"
              color={colors.oil}
              warningHigh={130}
              criticalHigh={150}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>INTAKE &amp; AIR</Text>
        <View style={styles.grid}>
          <View style={styles.col}>
            <GaugeCard
              label="Intake Temp"
              value={liveData.intakeTemp}
              unit="°C"
              color="#60A5FA"
              compact
              warningHigh={60}
            />
          </View>
          <View style={styles.col}>
            <GaugeCard
              label="MAP"
              value={liveData.map}
              unit="kPa"
              color="#34D399"
              compact
            />
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <GaugeCard
              label="MAF"
              value={liveData.maf}
              unit="g/s"
              color="#A78BFA"
              compact
              decimals={2}
            />
          </View>
          <View style={styles.col}>
            <GaugeCard
              label="Timing Adv."
              value={liveData.timingAdvance}
              unit="°"
              color="#F472B6"
              compact
              decimals={1}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>FUEL TRIMS</Text>
        <View style={styles.grid}>
          <View style={styles.col}>
            <GaugeCard
              label="STFT B1"
              value={liveData.stftB1}
              unit="%"
              color="#6EE7B7"
              compact
              decimals={1}
              warningHigh={15}
              warningLow={-15}
            />
          </View>
          <View style={styles.col}>
            <GaugeCard
              label="LTFT B1"
              value={liveData.ltftB1}
              unit="%"
              color="#93C5FD"
              compact
              decimals={1}
              warningHigh={15}
              warningLow={-15}
            />
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <GaugeCard
              label="O2 B1S1"
              value={liveData.o2B1S1}
              unit="V"
              color="#FCD34D"
              compact
              decimals={3}
            />
          </View>
          <View style={styles.col}>
            <GaugeCard
              label="Run Time"
              value={liveData.runTime}
              unit="s"
              color="#CBD5E1"
              compact
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 12,
  },
  disconnectedBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  disconnectedText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  sweepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  graphBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 12,
    marginTop: 8,
  },
  graphBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  graphDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  graphBannerText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  graphBannerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  col: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 2,
  },
});
