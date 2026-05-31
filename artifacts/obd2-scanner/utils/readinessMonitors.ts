export type MonitorStatus = "READY" | "NOT_READY" | "NA";
export type MonitorCategory = "continuous" | "non-continuous";

export interface ReadinessMonitor {
  id: string;
  name: string;
  shortName: string;
  description: string;
  status: MonitorStatus;
  category: MonitorCategory;
  /** Required to pass an emissions/smog test */
  emissionsRequired: boolean;
  /** Icon name from @expo/vector-icons Feather set */
  icon: string;
  /** What to drive to complete this monitor */
  driveCycleTip: string;
}

export const MONITOR_DEFS: Omit<ReadinessMonitor, "status">[] = [
  // ── Continuous monitors (always running) ─────────────────────────────────
  {
    id: "misfire",
    name: "Misfire Monitor",
    shortName: "Misfire",
    description: "Detects engine cylinder misfires that damage the catalyst or increase emissions",
    category: "continuous",
    emissionsRequired: true,
    icon: "activity",
    driveCycleTip: "Drive at varying RPM for 5+ min. Avoid rough idle or hard loads.",
  },
  {
    id: "fuel_system",
    name: "Fuel System",
    shortName: "Fuel Sys",
    description: "Monitors closed-loop fuel delivery and air/fuel mixture correction",
    category: "continuous",
    emissionsRequired: true,
    icon: "droplet",
    driveCycleTip: "Allow engine to reach operating temp, then drive at steady cruise 40–55 mph.",
  },
  {
    id: "components",
    name: "Comprehensive Components",
    shortName: "Components",
    description: "ECU input/output circuit checks — sensors, actuators, and communication",
    category: "continuous",
    emissionsRequired: true,
    icon: "cpu",
    driveCycleTip: "Run full EPA drive cycle: cold start, idle, acceleration, cruise, decel.",
  },
  // ── Non-continuous monitors (run once per drive cycle) ───────────────────
  {
    id: "catalyst",
    name: "Catalyst Monitor",
    shortName: "Catalyst",
    description: "Measures catalytic converter efficiency by comparing upstream/downstream O2 activity",
    category: "non-continuous",
    emissionsRequired: true,
    icon: "shield",
    driveCycleTip: "Highway cruise 55–60 mph for 5+ min after full warmup. No sudden stops.",
  },
  {
    id: "heated_catalyst",
    name: "Heated Catalyst",
    shortName: "Htd Cat",
    description: "Monitors electrically heated catalyst pre-heat system (if equipped)",
    category: "non-continuous",
    emissionsRequired: false,
    icon: "thermometer",
    driveCycleTip: "Cold start required. System runs in the first 2 minutes after startup.",
  },
  {
    id: "evap",
    name: "EVAP System",
    shortName: "EVAP",
    description: "Checks for fuel vapor leaks in the evaporative emission control system",
    category: "non-continuous",
    emissionsRequired: true,
    icon: "cloud",
    driveCycleTip: "Fill tank to 50–85%, cold start, idle 2 min, then 3+ miles steady cruise.",
  },
  {
    id: "secondary_air",
    name: "Secondary Air",
    shortName: "Sec Air",
    description: "Tests secondary air injection pump used to reduce cold-start emissions",
    category: "non-continuous",
    emissionsRequired: false,
    icon: "wind",
    driveCycleTip: "Cold start with engine off overnight. Air pump runs in first 30 seconds.",
  },
  {
    id: "ac_refrigerant",
    name: "A/C Refrigerant",
    shortName: "A/C Ref",
    description: "Monitors A/C refrigerant system for leaks (if OBD2 controlled)",
    category: "non-continuous",
    emissionsRequired: false,
    icon: "zap",
    driveCycleTip: "Run A/C on maximum cooling for 5+ min with engine at operating temperature.",
  },
  {
    id: "o2_sensor",
    name: "O2 Sensors",
    shortName: "O2 Sensor",
    description: "Tests oxygen sensor response time, voltage range, and switching frequency",
    category: "non-continuous",
    emissionsRequired: true,
    icon: "radio",
    driveCycleTip: "Steady cruise 45–65 mph for 5+ min in closed loop (after full warmup).",
  },
  {
    id: "o2_heater",
    name: "O2 Sensor Heater",
    shortName: "O2 Heater",
    description: "Verifies O2 sensor heater element circuits bring sensors to operating temp quickly",
    category: "non-continuous",
    emissionsRequired: true,
    icon: "sun",
    driveCycleTip: "Cold start. Monitor runs in first 2 minutes as heaters warm the sensors.",
  },
  {
    id: "egr_vvt",
    name: "EGR / VVT System",
    shortName: "EGR/VVT",
    description: "Tests exhaust gas recirculation flow and/or variable valve timing operation",
    category: "non-continuous",
    emissionsRequired: true,
    icon: "refresh-cw",
    driveCycleTip: "Cruise 35–55 mph, then decelerate to idle several times with no braking.",
  },
];

// ── Parse Mode 01 PID 01 response ─────────────────────────────────────────────
/**
 * Parses the 4-byte response from OBD2 command 0101.
 * Bytes: A(MIL+DTC count) B(continuous status) C(non-cont available) D(non-cont incomplete)
 *
 * Byte B bit layout (continuous monitors):
 *   Bits 5/6/7 = misfire/fuel_sys/components NOT available (inverted for CAN)
 *   Bits 1/2/3 = misfire/fuel_sys/components INCOMPLETE
 *
 * Byte C = non-continuous AVAILABLE bitmask (1=available)
 * Byte D = non-continuous INCOMPLETE bitmask (1=not done)
 *   Bit 0: catalyst  Bit 1: heated_catalyst  Bit 2: evap  Bit 3: secondary_air
 *   Bit 4: ac_refrigerant  Bit 5: o2_sensor  Bit 6: o2_heater  Bit 7: egr_vvt
 */
export function parsePID01Response(raw: string): ReadinessMonitor[] | null {
  const hex = raw.replace(/\s+/g, "").toUpperCase();
  const idx = hex.indexOf("4101");
  if (idx === -1) return null;

  const data = hex.substring(idx + 4);
  if (data.length < 8) return null;

  const byteB = parseInt(data.substring(2, 4), 16);
  const byteC = parseInt(data.substring(4, 6), 16);
  const byteD = parseInt(data.substring(6, 8), 16);

  if (isNaN(byteB) || isNaN(byteC) || isNaN(byteD)) return null;

  // Continuous monitors: bit set = NOT available; separate incomplete bits
  const CONT = [
    { id: "misfire",      availBit: 5, incompleteBit: 1 },
    { id: "fuel_system",  availBit: 6, incompleteBit: 2 },
    { id: "components",   availBit: 7, incompleteBit: 3 },
  ];
  // Non-continuous: byte C = available, byte D = incomplete (same bit positions)
  const NONCONT_ORDER = [
    "catalyst", "heated_catalyst", "evap", "secondary_air",
    "ac_refrigerant", "o2_sensor", "o2_heater", "egr_vvt",
  ];

  const statusMap: Record<string, MonitorStatus> = {};

  for (const { id, availBit, incompleteBit } of CONT) {
    const available = !(byteB & (1 << availBit));
    const incomplete = !!(byteB & (1 << incompleteBit));
    statusMap[id] = !available ? "NA" : incomplete ? "NOT_READY" : "READY";
  }

  for (let i = 0; i < NONCONT_ORDER.length; i++) {
    const id = NONCONT_ORDER[i];
    const available = !!(byteC & (1 << i));
    const incomplete = !!(byteD & (1 << i));
    statusMap[id] = !available ? "NA" : incomplete ? "NOT_READY" : "READY";
  }

  return MONITOR_DEFS.map((def) => ({
    ...def,
    status: statusMap[def.id] ?? "NA",
  }));
}

export function getDemoReadiness(): ReadinessMonitor[] {
  const statuses: MonitorStatus[] = [
    "READY", "READY", "READY",       // continuous
    "NOT_READY", "NA", "NOT_READY",  // catalyst, heated cat, evap
    "NA", "NA",                       // secondary air, a/c
    "READY", "READY",                // o2, o2 heater
    "NOT_READY",                     // egr/vvt
  ];
  return MONITOR_DEFS.map((def, i) => ({
    ...def,
    status: statuses[i] ?? "READY",
  }));
}
