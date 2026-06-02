export interface OBDCommandStep {
  cmd: string;
  desc: string;
  timeoutMs?: number;
  expectOk?: boolean;
}

export interface ServiceReset {
  id: string;
  name: string;
  description: string;
  category: string;
  warning?: string;
  steps?: string[];
  requiresEngineOff?: boolean;
  requiresEngineOn?: boolean;
  icon: string;
  dangerous: boolean;
  obdCommands: OBDCommandStep[];
}

export const SERVICE_CATEGORIES = [
  "Engine",
  "Transmission",
  "Brakes",
  "Steering",
  "Tires",
  "Body",
  "HVAC",
  "Battery",
];

const ECM = "ATSH 7E0";
const TCM = "ATSH 7E1";
const ABS = "ATSH 760";
const BCM = "ATSH 7B0";
const HVAC = "ATSH 733";
const EPS = "ATSH 730";

const commonStart = (header: string): OBDCommandStep[] => [
  { cmd: "ATSP0", desc: "Auto-detect vehicle protocol", timeoutMs: 5000, expectOk: true },
  { cmd: "ATH1", desc: "Enable headers for module responses", timeoutMs: 1000, expectOk: true },
  { cmd: header, desc: "Select target module", timeoutMs: 1000, expectOk: true },
  { cmd: "1003", desc: "Open extended diagnostic session", timeoutMs: 3000, expectOk: true },
  { cmd: "3E00", desc: "Keep diagnostic session alive", timeoutMs: 1000, expectOk: false },
];

const finish: OBDCommandStep[] = [
  { cmd: "3E00", desc: "Keep session alive while module stores changes", timeoutMs: 1000, expectOk: false },
  { cmd: "1001", desc: "Return module to default diagnostic session", timeoutMs: 1000, expectOk: false },
  { cmd: ECM, desc: "Return header to ECM", timeoutMs: 1000, expectOk: false },
];

const routine = (id: string, desc: string): OBDCommandStep => ({
  cmd: `3101${id}`,
  desc,
  timeoutMs: 7000,
  expectOk: true,
});

const writeData = (idAndData: string, desc: string): OBDCommandStep => ({
  cmd: `2E${idAndData}`,
  desc,
  timeoutMs: 5000,
  expectOk: true,
});

export const SERVICE_RESETS: ServiceReset[] = [
  {
    id: "oil_reset",
    name: "Oil Life Reset",
    description: "Reset engine oil life monitor after oil service. Uses an OEM-style routine when the ECM/BCM supports it.",
    category: "Engine",
    icon: "droplet",
    dangerous: false,
    requiresEngineOff: true,
    obdCommands: [...commonStart(ECM), routine("FF00", "Run oil-life/service interval reset routine"), ...finish],
    steps: ["Ignition ON, engine OFF", "Run reset", "Cycle ignition OFF then ON", "Verify oil life/service message cleared"],
  },
  {
    id: "throttle_relearn",
    name: "Throttle Body Relearn",
    description: "Request throttle/idle actuator learn after throttle body cleaning or replacement.",
    category: "Engine",
    icon: "activity",
    dangerous: false,
    requiresEngineOff: true,
    obdCommands: [...commonStart(ECM), routine("FF01", "Run throttle position learn routine"), ...finish],
    steps: ["Ignition ON, engine OFF", "Do not touch accelerator", "Run relearn", "Start and idle until stable"],
  },
  {
    id: "idle_relearn",
    name: "Idle Speed Relearn",
    description: "Clear idle adaptive values and request idle relearn.",
    category: "Engine",
    icon: "sliders",
    dangerous: false,
    requiresEngineOn: true,
    obdCommands: [...commonStart(ECM), routine("FF02", "Run idle air/adaptive relearn routine"), ...finish],
    steps: ["Engine warm", "A/C and accessories OFF", "Run reset", "Let engine idle several minutes"],
  },
  {
    id: "evap_reset",
    name: "EVAP Monitor Reset",
    description: "Clear emissions readiness by clearing DTC memory; monitor must rerun during a drive cycle.",
    category: "Engine",
    icon: "cloud",
    dangerous: false,
    obdCommands: [{ cmd: "04", desc: "Clear emissions DTCs/readiness monitors", timeoutMs: 7000, expectOk: true }],
    steps: ["Repair EVAP faults first", "Run clear", "Complete the required drive cycle"],
  },
  {
    id: "fuel_trim_reset",
    name: "Fuel Trim / Injector Adapt Reset",
    description: "Clear fuel trim adaptive memory where supported by the ECM.",
    category: "Engine",
    icon: "zap",
    dangerous: false,
    obdCommands: [...commonStart(ECM), routine("FF03", "Run fuel trim adaptive reset routine"), ...finish],
    steps: ["Engine warm", "No active fuel system faults", "Run reset", "Drive normally while trims relearn"],
  },
  {
    id: "maf_reset",
    name: "MAF Adaptation Reset",
    description: "Clear MAF airflow adaptive values after sensor cleaning or replacement.",
    category: "Engine",
    icon: "wind",
    dangerous: false,
    obdCommands: [...commonStart(ECM), routine("FF04", "Run MAF adaptive reset routine"), ...finish],
    steps: ["Install/clean MAF", "Run reset", "Idle two minutes", "Light drive cycle"],
  },
  {
    id: "trans_adaptive",
    name: "Transmission Adaptive Reset",
    description: "Clear learned shift adaptives where supported by the TCM.",
    category: "Transmission",
    icon: "git-branch",
    dangerous: true,
    warning: "Shifts may feel harsh until relearn completes. Drive gently after reset.",
    obdCommands: [...commonStart(TCM), routine("FF10", "Run TCM shift adaptive reset routine"), ...finish],
    steps: ["Transmission at operating temperature", "Vehicle stopped", "Run reset", "Perform gentle relearn drive"],
  },
  {
    id: "tcc_reset",
    name: "TCC Adaptation Reset",
    description: "Reset torque converter clutch slip/adaptive values where supported.",
    category: "Transmission",
    icon: "settings",
    dangerous: false,
    obdCommands: [...commonStart(TCM), routine("FF11", "Run TCC adaptive reset routine"), ...finish],
    steps: ["Vehicle stopped", "Run reset", "Drive at steady speeds so TCC can relearn"],
  },
  {
    id: "epb_retract",
    name: "EPB Retract Service Mode",
    description: "Command electronic parking brake service/retract mode where supported by ABS/EPB module.",
    category: "Brakes",
    icon: "unlock",
    dangerous: true,
    warning: "Chock wheels first. Vehicle can roll while EPB is released.",
    requiresEngineOff: true,
    obdCommands: [...commonStart(ABS), routine("FF20", "Run EPB retract/service mode routine"), ...finish],
    steps: ["Flat surface", "Chock wheels", "Ignition ON", "Run retract", "Replace pads"],
  },
  {
    id: "epb_apply",
    name: "EPB Apply / Exit Service Mode",
    description: "Seat electronic parking brake after service where supported.",
    category: "Brakes",
    icon: "lock",
    dangerous: true,
    obdCommands: [...commonStart(ABS), routine("FF21", "Run EPB apply/exit service mode routine"), ...finish],
    steps: ["Pads installed", "Ignition ON", "Run apply", "Verify brake pedal and EPB operation"],
  },
  {
    id: "abs_bleed",
    name: "ABS Pump Bleeding",
    description: "Cycle ABS hydraulic bleed routine where supported.",
    category: "Brakes",
    icon: "droplet",
    dangerous: true,
    warning: "Only run during proper brake bleeding with fluid maintained. Do not run system dry.",
    obdCommands: [...commonStart(ABS), routine("FF22", "Run ABS automated bleed routine"), ...finish],
    steps: ["Fill brake fluid", "Attach bleed equipment", "Run routine", "Follow wheel sequence"],
  },
  {
    id: "brake_wear_reset",
    name: "Brake Wear Indicator Reset",
    description: "Reset brake pad wear counter/sensor warning where supported.",
    category: "Brakes",
    icon: "disc",
    dangerous: false,
    obdCommands: [...commonStart(ABS), routine("FF23", "Run brake wear reset routine"), ...finish],
    steps: ["Install pads/sensors", "Run reset", "Verify warning cleared"],
  },
  {
    id: "steering_angle",
    name: "Steering Angle Calibration",
    description: "Calibrate steering angle sensor after alignment or steering service.",
    category: "Steering",
    icon: "navigation",
    dangerous: false,
    requiresEngineOn: true,
    obdCommands: [...commonStart(EPS), routine("FF30", "Run steering angle zero-point calibration"), ...finish],
    steps: ["Wheels straight", "Flat level surface", "Run calibration", "Drive slowly straight ahead"],
  },
  {
    id: "eps_reset",
    name: "EPS Torque Sensor Reset",
    description: "Reset EPS torque sensor zero-point where supported.",
    category: "Steering",
    icon: "refresh-cw",
    dangerous: false,
    obdCommands: [...commonStart(EPS), routine("FF31", "Run EPS torque zero-point reset"), ...finish],
    steps: ["Steering centered", "Hands off wheel", "Run reset", "Verify assist works normally"],
  },
  {
    id: "tpms_relearn",
    name: "TPMS Sensor Relearn",
    description: "Request TPMS learn mode where supported by BCM/TPMS module.",
    category: "Tires",
    icon: "circle",
    dangerous: false,
    obdCommands: [...commonStart(BCM), routine("FF40", "Enter TPMS sensor learn mode"), ...finish],
    steps: ["Set tire pressures", "Run learn mode", "Trigger sensors FL/FR/RR/RL", "Verify IDs learned"],
  },
  {
    id: "tpms_pressure_reset",
    name: "TPMS Pressure Baseline",
    description: "Store current tire pressure baseline where supported.",
    category: "Tires",
    icon: "trending-up",
    dangerous: false,
    obdCommands: [...commonStart(BCM), routine("FF41", "Store TPMS pressure baseline routine"), ...finish],
    steps: ["Inflate all tires to placard", "Run reset", "Drive until warning clears"],
  },
  {
    id: "window_calibration",
    name: "Window Auto-Up Calibration",
    description: "Run body module window normalization where supported.",
    category: "Body",
    icon: "square",
    dangerous: false,
    obdCommands: [...commonStart(BCM), routine("FF50", "Run window normalization/calibration routine"), ...finish],
    steps: ["Ignition ON", "Run routine", "Test one-touch up/down"],
  },
  {
    id: "sunroof_calibration",
    name: "Sunroof Calibration",
    description: "Run sunroof position normalization where supported.",
    category: "Body",
    icon: "sun",
    dangerous: false,
    obdCommands: [...commonStart(BCM), routine("FF51", "Run sunroof calibration routine"), ...finish],
    steps: ["Close sunroof", "Run calibration", "Let cycle finish", "Test operation"],
  },
  {
    id: "battery_registration",
    name: "Battery Registration",
    description: "Register replacement battery metadata where supported by BCM/energy module.",
    category: "Battery",
    icon: "battery-charging",
    dangerous: false,
    obdCommands: [...commonStart(BCM), writeData("F19041474D303030313030", "Write sample battery type/capacity placeholder data"), routine("FF60", "Run battery registration routine"), ...finish],
    steps: ["Install correct battery", "Enter battery specs if app prompts", "Run registration", "Verify charging voltage"],
  },
  {
    id: "alternator_reset",
    name: "Charging System Reset",
    description: "Reset charging/energy management adaptives where supported.",
    category: "Battery",
    icon: "zap",
    dangerous: false,
    obdCommands: [...commonStart(BCM), routine("FF61", "Run charging system adaptive reset routine"), ...finish],
    steps: ["Battery healthy", "Run reset", "Idle 20 minutes", "Verify charging output"],
  },
  {
    id: "hvac_blend",
    name: "HVAC Blend Door Calibration",
    description: "Calibrate HVAC actuator end stops where supported.",
    category: "HVAC",
    icon: "thermometer",
    dangerous: false,
    obdCommands: [...commonStart(HVAC), routine("FF70", "Run HVAC actuator calibration routine"), ...finish],
    steps: ["Ignition ON", "HVAC off", "Run routine", "Wait for all doors to stop moving"],
  },
  {
    id: "ac_service",
    name: "A/C Service Reset",
    description: "Reset A/C service counter where supported.",
    category: "HVAC",
    icon: "wind",
    dangerous: false,
    obdCommands: [...commonStart(HVAC), routine("FF71", "Run A/C service counter reset routine"), ...finish],
    steps: ["Complete A/C service", "Run reset", "Verify no HVAC warnings"],
  },
];
