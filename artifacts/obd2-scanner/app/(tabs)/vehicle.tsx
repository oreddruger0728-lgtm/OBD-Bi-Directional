import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBar } from "@/components/ConnectionBar";
import { useOBD2 } from "@/contexts/OBD2Context";
import { useColors } from "@/hooks/useColors";
import type { ReadinessMonitor } from "@/utils/readinessMonitors";
import { buildEngineLabel, type VehicleSpecs } from "@/utils/vinDecoder";

// ── Shared sub-components ──────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: mono ? "Inter_500Medium" : "Inter_400Regular" }]} selectable>
        {value}
      </Text>
    </View>
  );
}

function SectionCard({ title, icon, iconColor, badge, children }: {
  title: string; icon: string; iconColor?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Feather name={icon as any} size={13} color={iconColor ?? colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        {badge}
      </View>
      {children}
    </View>
  );
}

function SpecBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  const c = color ?? colors.primary;
  return (
    <View style={[styles.specBadge, { backgroundColor: c + "18", borderColor: c + "40" }]}>
      <Text style={[styles.specBadgeLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.specBadgeValue, { color: c }]}>{value}</Text>
    </View>
  );
}

// ── Vehicle identity card ──────────────────────────────────────────────────────

function VehicleIdentityCard({ specs, onReDecode, isDecoding }: { specs: VehicleSpecs; onReDecode: () => void; isDecoding: boolean }) {
  const colors = useColors();
  const engineLabel = buildEngineLabel(specs);
  const yearMakeModel = [specs.year, specs.make, specs.model].filter(Boolean).join(" ");
  const trimSeries = [specs.trim, specs.series].filter(Boolean).join(" · ");

  return (
    <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.identityHeader, { borderBottomColor: colors.border }]}>
        <View style={[styles.identityIconRing, { borderColor: colors.primary + "40", backgroundColor: colors.primary + "12" }]}>
          <Feather name="truck" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          {yearMakeModel ? (
            <>
              <Text style={[styles.yearMakeModel, { color: colors.foreground }]}>{yearMakeModel}</Text>
              {trimSeries ? <Text style={[styles.trimSeries, { color: colors.primary }]}>{trimSeries}</Text> : null}
            </>
          ) : (
            <Text style={[styles.yearMakeModel, { color: colors.mutedForeground }]}>Unknown Vehicle</Text>
          )}
          <Text style={[styles.vinChip, { color: colors.mutedForeground }]}>{specs.vin}</Text>
        </View>
        <TouchableOpacity onPress={onReDecode} disabled={isDecoding} style={styles.reDecodeBtn}>
          {isDecoding
            ? <ActivityIndicator size="small" color={colors.mutedForeground} />
            : <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />}
        </TouchableOpacity>
      </View>

      {specs.error && (
        <View style={[styles.errorBanner, { backgroundColor: "#FF444415", borderColor: "#FF4444" }]}>
          <Feather name="alert-circle" size={12} color="#FF4444" />
          <Text style={styles.errorBannerText}>{specs.error}</Text>
        </View>
      )}

      {!specs.error && (
        <>
          <View style={styles.specBadges}>
            {specs.bodyClass && <SpecBadge label="BODY" value={specs.bodyClass} color="#60A5FA" />}
            {specs.doors && <SpecBadge label="DOORS" value={specs.doors} color="#94A3B8" />}
            {specs.driveType && <SpecBadge label="DRIVE" value={specs.driveType} color="#34D399" />}
            {specs.vehicleType && <SpecBadge label="TYPE" value={specs.vehicleType} color="#A78BFA" />}
          </View>

          {engineLabel ? (
            <View style={[styles.engineBanner, { backgroundColor: "#00D4FF0D", borderColor: "#00D4FF30" }]}>
              <Feather name="zap" size={14} color="#00D4FF" />
              <Text style={[styles.engineBannerText, { color: "#00D4FF" }]}>{engineLabel}</Text>
              {specs.turbo && specs.turbo.toLowerCase().includes("yes") && (
                <View style={[styles.turboBadge, { backgroundColor: "#FFB80025" }]}>
                  <Text style={[styles.turboBadgeText, { color: "#FFB800" }]}>TURBO</Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={[styles.specGrid, { borderTopColor: colors.border }]}>
            {specs.engineCylinders && <InfoRow label="Cylinders" value={specs.engineCylinders + "-cyl"} />}
            {specs.engineDisplacementL && <InfoRow label="Displacement" value={parseFloat(specs.engineDisplacementL).toFixed(1) + " L (" + (specs.engineDisplacementCC ? Math.round(parseFloat(specs.engineDisplacementCC)) + " cc" : "") + ")"} />}
            {specs.engineHP && <InfoRow label="Horsepower" value={specs.engineHP + " hp"} />}
            {specs.engineConfiguration && <InfoRow label="Configuration" value={specs.engineConfiguration} />}
            {specs.fuelType && <InfoRow label="Fuel Type" value={specs.fuelType} />}
            {specs.fuelInjectionType && <InfoRow label="Injection" value={specs.fuelInjectionType} />}
            {specs.transmissionStyle && <InfoRow label="Transmission" value={[specs.transmissionStyle, specs.transmissionSpeeds ? specs.transmissionSpeeds + "-speed" : ""].filter(Boolean).join(" ")} />}
            {specs.driveType && <InfoRow label="Drive Type" value={specs.driveType} />}
            {specs.gvwr && <InfoRow label="GVWR" value={specs.gvwr} />}
            {specs.abs && <InfoRow label="ABS" value={specs.abs} />}
            {specs.esc && <InfoRow label="ESC" value={specs.esc} />}
            {specs.manufacturerName && <InfoRow label="Manufacturer" value={specs.manufacturerName} />}
            {specs.plantCountry && <InfoRow label="Built In" value={[specs.plantState, specs.plantCountry].filter(Boolean).join(", ")} />}
            {specs.otherEngineInfo && <InfoRow label="Engine Notes" value={specs.otherEngineInfo} />}
          </View>
        </>
      )}
    </View>
  );
}

// ── VIN lookup card ────────────────────────────────────────────────────────────

function ManualVINCard() {
  const colors = useColors();
  const { decodeVin, isDecodingVIN, vehicleSpecs, clearVehicleSpecs } = useOBD2();
  const [vinInput, setVinInput] = useState(vehicleSpecs?.vin ?? "");
  const inputRef = useRef<TextInput>(null);

  const handleDecode = async () => {
    const vin = vinInput.trim().toUpperCase();
    if (vin.length !== 17) {
      Alert.alert("Invalid VIN", "A VIN must be exactly 17 characters.");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    inputRef.current?.blur();
    await decodeVin(vin);
  };

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Feather name="search" size={13} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>VIN Lookup</Text>
        <Text style={[styles.poweredBy, { color: colors.mutedForeground }]}>NHTSA database</Text>
      </View>
      <View style={styles.vinInputRow}>
        <TextInput
          ref={inputRef}
          style={[styles.vinInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
          value={vinInput}
          onChangeText={(t) => setVinInput(t.toUpperCase())}
          placeholder="Enter 17-character VIN"
          placeholderTextColor={colors.mutedForeground}
          maxLength={17}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          onSubmitEditing={handleDecode}
        />
        <TouchableOpacity
          style={[styles.decodeBtn, { backgroundColor: colors.primary, opacity: isDecodingVIN || vinInput.trim().length < 17 ? 0.5 : 1 }]}
          onPress={handleDecode}
          disabled={isDecodingVIN || vinInput.trim().length < 17}
          activeOpacity={0.8}
        >
          {isDecodingVIN
            ? <ActivityIndicator color="#000" size="small" />
            : <Feather name="search" size={16} color="#000" />}
        </TouchableOpacity>
      </View>
      <View style={styles.vinCounter}>
        <Text style={[styles.vinCounterText, { color: vinInput.length === 17 ? colors.success : colors.mutedForeground }]}>
          {vinInput.length}/17 characters{vinInput.length === 17 ? "  ✓" : ""}
        </Text>
        {vehicleSpecs && (
          <TouchableOpacity onPress={() => { clearVehicleSpecs(); setVinInput(""); }}>
            <Text style={[styles.clearLink, { color: "#FF4444" }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Readiness dashboard ────────────────────────────────────────────────────────

function ReadinessDashboard() {
  const colors = useColors();
  const { readinessMonitors, refreshReadiness, connectionStatus } = useOBD2();
  const isConnected = connectionStatus === "CONNECTED";
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const readyCount  = readinessMonitors.filter((m) => m.status === "READY").length;
  const notReady    = readinessMonitors.filter((m) => m.status === "NOT_READY");
  const applicable  = readinessMonitors.filter((m) => m.status !== "NA");
  const allPass     = notReady.length === 0 && applicable.length > 0;
  const requiredFail = notReady.filter((m) => m.emissionsRequired);

  const handleRefresh = async () => {
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refreshReadiness();
    setLoading(false);
  };

  if (readinessMonitors.length === 0) {
    return (
      <SectionCard title="I/M Readiness Monitors" icon="check-square">
        <View style={styles.emptySection}>
          <Text style={[styles.emptySectionText, { color: colors.mutedForeground }]}>
            OBD2 drive cycle completion status — required for emissions / smog testing
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { borderColor: colors.primary, opacity: isConnected ? 1 : 0.4 }]}
            onPress={handleRefresh}
            disabled={!isConnected || loading}
          >
            {loading
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Feather name="check-square" size={13} color={colors.primary} />}
            <Text style={[styles.refreshBtnText, { color: colors.primary }]}>
              {loading ? "Reading ECU..." : "Read Monitors"}
            </Text>
          </TouchableOpacity>
        </View>
      </SectionCard>
    );
  }

  // Emissions verdict banner
  const verdictColor = allPass ? "#00E87A" : requiredFail.length > 0 ? "#FF4444" : "#FFB800";
  const verdictIcon  = allPass ? "check-circle" : requiredFail.length > 0 ? "x-circle" : "alert-circle";
  const verdictTitle = allPass
    ? "EMISSIONS READY"
    : requiredFail.length > 0
    ? "EMISSIONS NOT READY"
    : "MARGINAL — CHECK INCOMPLETE";
  const verdictSub = allPass
    ? "All required monitors have completed their drive cycle"
    : requiredFail.length > 0
    ? `${requiredFail.length} required monitor${requiredFail.length > 1 ? "s" : ""} still need${requiredFail.length === 1 ? "s" : ""} a drive cycle`
    : "Some optional monitors are incomplete — required ones are done";

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card header */}
      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Feather name="check-square" size={13} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>I/M Readiness Monitors</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={loading || !isConnected} style={styles.refreshIconBtn}>
          {loading
            ? <ActivityIndicator size="small" color={colors.mutedForeground} />
            : <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />}
        </TouchableOpacity>
      </View>

      {/* Emissions verdict */}
      <View style={[styles.verdictBanner, { backgroundColor: verdictColor + "15", borderBottomColor: verdictColor + "40", borderBottomWidth: 1 }]}>
        <View style={[styles.verdictIconRing, { backgroundColor: verdictColor + "25", borderColor: verdictColor + "50" }]}>
          <Feather name={verdictIcon as any} size={22} color={verdictColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.verdictTitle, { color: verdictColor }]}>{verdictTitle}</Text>
          <Text style={[styles.verdictSub, { color: colors.mutedForeground }]}>{verdictSub}</Text>
        </View>
      </View>

      {/* Progress bar + counts */}
      <View style={[styles.progressSection, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <View style={styles.progressStats}>
          <View style={styles.progressStatItem}>
            <Text style={[styles.progressStatNum, { color: "#00E87A" }]}>{readyCount}</Text>
            <Text style={[styles.progressStatLabel, { color: colors.mutedForeground }]}>READY</Text>
          </View>
          <View style={[styles.progressStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.progressStatItem}>
            <Text style={[styles.progressStatNum, { color: "#FF4444" }]}>{notReady.length}</Text>
            <Text style={[styles.progressStatLabel, { color: colors.mutedForeground }]}>NOT READY</Text>
          </View>
          <View style={[styles.progressStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.progressStatItem}>
            <Text style={[styles.progressStatNum, { color: colors.mutedForeground }]}>
              {readinessMonitors.filter((m) => m.status === "NA").length}
            </Text>
            <Text style={[styles.progressStatLabel, { color: colors.mutedForeground }]}>N/A</Text>
          </View>
          <View style={[styles.progressStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.progressStatItem}>
            <Text style={[styles.progressStatNum, { color: colors.foreground }]}>{applicable.length}</Text>
            <Text style={[styles.progressStatLabel, { color: colors.mutedForeground }]}>TOTAL</Text>
          </View>
        </View>
        {/* Segmented progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
          {applicable.length > 0 && (
            <View style={[styles.progressFill, {
              width: `${(readyCount / applicable.length) * 100}%` as any,
              backgroundColor: allPass ? "#00E87A" : "#FFB800",
            }]} />
          )}
        </View>
        <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
          {readyCount} of {applicable.length} monitors complete
        </Text>
      </View>

      {/* Monitor cards — two columns, tap to expand for drive cycle tip */}
      <View style={styles.monitorGrid}>
        {readinessMonitors.map((m) => {
          const statusColor = m.status === "READY" ? "#00E87A" : m.status === "NOT_READY" ? "#FF4444" : colors.mutedForeground;
          const isExpanded = expandedId === m.id;
          const canExpand = m.status === "NOT_READY";

          return (
            <TouchableOpacity
              key={m.id}
              activeOpacity={canExpand ? 0.75 : 1}
              onPress={() => canExpand && setExpandedId(isExpanded ? null : m.id)}
              style={[
                styles.monitorCard,
                { backgroundColor: colors.secondary, borderColor: isExpanded ? statusColor : colors.border },
              ]}
            >
              {/* Icon + status dot */}
              <View style={styles.monitorCardTop}>
                <View style={[styles.monitorIconRing, { backgroundColor: statusColor + "18" }]}>
                  <Feather name={m.icon as any} size={15} color={statusColor} />
                </View>
                <View style={[styles.monitorStatusDot, { backgroundColor: statusColor }]} />
              </View>

              {/* Name + status badge */}
              <Text style={[styles.monitorCardName, { color: colors.foreground }]} numberOfLines={2}>
                {m.shortName}
              </Text>
              <View style={[styles.monitorStatusBadge, { backgroundColor: statusColor + "20" }]}>
                <Text style={[styles.monitorStatusText, { color: statusColor }]}>
                  {m.status === "READY" ? "READY" : m.status === "NOT_READY" ? "INCOMPLETE" : "N/A"}
                </Text>
              </View>

              {/* Required indicator */}
              {m.emissionsRequired && m.status !== "NA" && (
                <Text style={[styles.monitorRequired, { color: colors.mutedForeground }]}>⚡ REQUIRED</Text>
              )}

              {/* Expanded drive cycle tip */}
              {isExpanded && (
                <View style={[styles.monitorTip, { backgroundColor: "#FFB80012", borderTopColor: "#FFB80030" }]}>
                  <Feather name="navigation" size={10} color="#FFB800" />
                  <Text style={[styles.monitorTipText, { color: "#FFB800" }]}>{m.driveCycleTip}</Text>
                </View>
              )}

              {/* Tap hint for incomplete */}
              {canExpand && !isExpanded && (
                <Text style={[styles.tapHint, { color: colors.mutedForeground }]}>Tap for tip</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={[styles.monitorLegend, { borderTopColor: colors.border }]}>
        <Feather name="info" size={10} color={colors.mutedForeground} />
        <Text style={[styles.monitorLegendText, { color: colors.mutedForeground }]}>
          Tap any INCOMPLETE monitor for drive cycle tips · ⚡ = emissions test required
        </Text>
      </View>
    </View>
  );
}

// ── Misfire card ───────────────────────────────────────────────────────────────

function MisfireCard() {
  const colors = useColors();
  const { misfireCounters, refreshMisfires, connectionStatus } = useOBD2();
  const isConnected = connectionStatus === "CONNECTED";
  const [loading, setLoading] = useState(false);
  const totalMisfires = misfireCounters.reduce((a, m) => a + m.count, 0);

  return (
    <SectionCard title="Misfire Counters" icon="activity">
      {misfireCounters.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={[styles.emptySectionText, { color: colors.mutedForeground }]}>Per-cylinder misfire event counts</Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { borderColor: colors.primary, opacity: isConnected ? 1 : 0.4 }]}
            onPress={async () => { setLoading(true); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await refreshMisfires(); setLoading(false); }}
            disabled={!isConnected || loading}
          >
            {loading ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="activity" size={13} color={colors.primary} />}
            <Text style={[styles.refreshBtnText, { color: colors.primary }]}>{loading ? "Reading..." : "Read Misfires"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.misfireGrid}>
          {misfireCounters.map((m) => {
            const bad = m.count > 0;
            return (
              <View key={m.cylinder} style={[styles.misfireCell, { backgroundColor: bad ? "#FF444420" : colors.secondary, borderColor: bad ? "#FF4444" : colors.border }]}>
                <Text style={[styles.misfireCylLabel, { color: colors.mutedForeground }]}>CYL {m.cylinder}</Text>
                <Text style={[styles.misfireCount, { color: bad ? "#FF4444" : "#00E87A" }]}>{m.count}</Text>
                {bad && <View style={[styles.misfireAt, { backgroundColor: "#FFB80020" }]}><Text style={[styles.misfireAtText, { color: "#FFB800" }]}>@ {m.rpm} rpm</Text></View>}
              </View>
            );
          })}
          <View style={[styles.misfireTotal, { borderTopColor: colors.border }]}>
            <Text style={[styles.misfireTotalLabel, { color: colors.mutedForeground }]}>Total misfire events</Text>
            <Text style={[styles.misfireTotalCount, { color: totalMisfires > 0 ? "#FF4444" : "#00E87A" }]}>{totalMisfires}</Text>
          </View>
        </View>
      )}
    </SectionCard>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function VehicleScreen() {
  const colors = useColors();
  const {
    vehicleInfo, vehicleSpecs, isDecodingVIN, freezeFrame,
    refreshVehicleInfo, refreshFreezeFrame, decodeVin, connectionStatus,
  } = useOBD2();
  const insets = useSafeAreaInsets();
  const isConnected = connectionStatus === "CONNECTED";
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingFF, setLoadingFF] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ConnectionBar />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ManualVINCard />

        {vehicleSpecs && (
          <VehicleIdentityCard
            specs={vehicleSpecs}
            onReDecode={() => decodeVin(vehicleSpecs.vin)}
            isDecoding={isDecodingVIN}
          />
        )}
        {isDecodingVIN && !vehicleSpecs && (
          <View style={[styles.decodingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.decodingText, { color: colors.mutedForeground }]}>Querying NHTSA database...</Text>
          </View>
        )}

        {/* OBD2 Module Info */}
        <SectionCard title="OBD2 Module Info" icon="cpu">
          {!vehicleInfo ? (
            <View style={styles.emptySection}>
              <Text style={[styles.emptySectionText, { color: colors.mutedForeground }]}>Protocol, ECU name, calibration ID, CVN</Text>
              <TouchableOpacity
                style={[styles.refreshBtn, { borderColor: colors.primary, opacity: isConnected ? 1 : 0.4 }]}
                onPress={async () => { setLoadingInfo(true); await refreshVehicleInfo(); setLoadingInfo(false); }}
                disabled={!isConnected || loadingInfo}
              >
                {loadingInfo ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="refresh-cw" size={13} color={colors.primary} />}
                <Text style={[styles.refreshBtnText, { color: colors.primary }]}>{loadingInfo ? "Reading..." : "Read from ECU"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <InfoRow label="VIN" value={vehicleInfo.vin} mono />
              <InfoRow label="Protocol" value={vehicleInfo.protocol} />
              <InfoRow label="ECU Name" value={vehicleInfo.ecuName} />
              <InfoRow label="Calibration ID" value={vehicleInfo.calibrationId} mono />
              <InfoRow label="CVN" value={vehicleInfo.cvn} mono />
              <InfoRow label="Fuel Type" value={vehicleInfo.fuelType} />
              <InfoRow label="OBD Standard" value={vehicleInfo.obd2Support} />
              <TouchableOpacity
                style={[styles.refreshSmallBtn, { borderColor: colors.border }]}
                onPress={async () => { setLoadingInfo(true); await refreshVehicleInfo(); setLoadingInfo(false); }}
              >
                {loadingInfo ? <ActivityIndicator color={colors.mutedForeground} size="small" /> : <Feather name="refresh-cw" size={11} color={colors.mutedForeground} />}
                <Text style={[styles.refreshSmallText, { color: colors.mutedForeground }]}>Refresh</Text>
              </TouchableOpacity>
            </>
          )}
        </SectionCard>

        {/* Readiness dashboard (self-contained) */}
        <ReadinessDashboard />

        <MisfireCard />

        {/* Freeze Frame */}
        <SectionCard title="Global Freeze Frame" icon="camera">
          {!freezeFrame ? (
            <View style={styles.emptySection}>
              <Text style={[styles.emptySectionText, { color: colors.mutedForeground }]}>
                Sensor snapshot captured when a DTC was first stored (Mode 02 frame 0)
              </Text>
              <TouchableOpacity
                style={[styles.refreshBtn, { borderColor: colors.primary, opacity: isConnected ? 1 : 0.4 }]}
                onPress={async () => { setLoadingFF(true); await refreshFreezeFrame(); setLoadingFF(false); }}
                disabled={!isConnected || loadingFF}
              >
                {loadingFF ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="camera" size={13} color={colors.primary} />}
                <Text style={[styles.refreshBtnText, { color: colors.primary }]}>{loadingFF ? "Reading..." : "Read Freeze Frame"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <InfoRow label="Trigger DTC" value={freezeFrame.dtc} mono />
              <InfoRow label="Captured At" value={freezeFrame.timestamp.toLocaleTimeString()} />
              {freezeFrame.data.rpm != null && <InfoRow label="RPM" value={`${freezeFrame.data.rpm} rpm`} mono />}
              {freezeFrame.data.speed != null && <InfoRow label="Speed" value={`${freezeFrame.data.speed} km/h`} mono />}
              {freezeFrame.data.coolantTemp != null && <InfoRow label="Coolant Temp" value={`${freezeFrame.data.coolantTemp} °C`} mono />}
              {freezeFrame.data.throttle != null && <InfoRow label="Throttle Pos." value={`${freezeFrame.data.throttle} %`} mono />}
              {freezeFrame.data.engineLoad != null && <InfoRow label="Engine Load" value={`${freezeFrame.data.engineLoad} %`} mono />}
              {freezeFrame.data.stftB1 != null && <InfoRow label="STFT B1" value={`${freezeFrame.data.stftB1} %`} mono />}
              {freezeFrame.data.ltftB1 != null && <InfoRow label="LTFT B1" value={`${freezeFrame.data.ltftB1} %`} mono />}
              {freezeFrame.data.batteryVoltage != null && <InfoRow label="Battery" value={`${freezeFrame.data.batteryVoltage} V`} mono />}
              <TouchableOpacity
                style={[styles.refreshSmallBtn, { borderColor: colors.border }]}
                onPress={async () => { setLoadingFF(true); await refreshFreezeFrame(); setLoadingFF(false); }}
              >
                <Feather name="refresh-cw" size={11} color={colors.mutedForeground} />
                <Text style={[styles.refreshSmallText, { color: colors.mutedForeground }]}>Refresh</Text>
              </TouchableOpacity>
            </>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 12, gap: 12 },

  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2, flex: 1 },
  poweredBy: { fontSize: 9, fontFamily: "Inter_400Regular", letterSpacing: 0.3 },
  refreshIconBtn: { padding: 4 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, gap: 10 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular", minWidth: 100 },
  infoValue: { fontSize: 12, flex: 1, textAlign: "right", letterSpacing: 0.2 },

  emptySection: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 16, gap: 10 },
  emptySectionText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 17 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  refreshBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  refreshSmallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, margin: 10, borderWidth: 1, borderRadius: 6, paddingVertical: 6 },
  refreshSmallText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  // Readiness dashboard
  verdictBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  verdictIconRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  verdictTitle: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  verdictSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 15 },

  progressSection: { paddingHorizontal: 14, paddingVertical: 12 },
  progressStats: { flexDirection: "row", marginBottom: 10 },
  progressStatItem: { flex: 1, alignItems: "center" },
  progressStatDivider: { width: 1 },
  progressStatNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  progressStatLabel: { fontSize: 8, fontFamily: "Inter_500Medium", letterSpacing: 0.8, marginTop: 1 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },

  monitorGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 8 },
  monitorCard: { width: "47%", borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  monitorCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  monitorIconRing: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  monitorStatusDot: { width: 8, height: 8, borderRadius: 4 },
  monitorCardName: { fontSize: 12, fontFamily: "Inter_600SemiBold", lineHeight: 16 },
  monitorStatusBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  monitorStatusText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  monitorRequired: { fontSize: 8, fontFamily: "Inter_500Medium", letterSpacing: 0.3, marginTop: 1 },
  monitorTip: { marginTop: 6, borderTopWidth: 1, paddingTop: 6, flexDirection: "row", gap: 5, alignItems: "flex-start" },
  monitorTipText: { fontSize: 10, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 14 },
  tapHint: { fontSize: 9, fontFamily: "Inter_400Regular", marginTop: 2 },
  monitorLegend: { flexDirection: "row", gap: 6, alignItems: "flex-start", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  monitorLegendText: { fontSize: 10, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 14 },

  // Misfire
  misfireGrid: { padding: 12, gap: 8 },
  misfireCell: { borderRadius: 8, borderWidth: 1, padding: 10, alignItems: "center", gap: 2 },
  misfireCylLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  misfireCount: { fontSize: 24, fontFamily: "Inter_700Bold" },
  misfireAt: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  misfireAtText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  misfireTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1, marginTop: 4 },
  misfireTotalLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  misfireTotalCount: { fontSize: 18, fontFamily: "Inter_700Bold" },

  // VehicleIdentityCard
  identityCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  identityHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1 },
  identityIconRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  yearMakeModel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  trimSeries: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  vinChip: { fontSize: 10, fontFamily: "Inter_400Regular", letterSpacing: 0.5, marginTop: 3 },
  reDecodeBtn: { padding: 6 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 6, margin: 12, padding: 10, borderRadius: 8, borderWidth: 1 },
  errorBannerText: { color: "#FF4444", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  specBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 12 },
  specBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignItems: "center" },
  specBadgeLabel: { fontSize: 8, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  specBadgeValue: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  engineBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 12, padding: 10, borderRadius: 8, borderWidth: 1 },
  engineBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  turboBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  turboBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  specGrid: { borderTopWidth: 1 },

  // ManualVINCard
  vinInputRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  vinInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  decodeBtn: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  vinCounter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8 },
  vinCounterText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  clearLink: { fontSize: 12, fontFamily: "Inter_500Medium" },

  decodingCard: { borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  decodingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
