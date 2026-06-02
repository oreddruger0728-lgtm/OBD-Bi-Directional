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
  moduleAddr: string;
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

const udsRoutine = (header: string, routine: string): OBDCommandStep[] => [
  { cmd: `ATSH ${header}`, desc: `Select module ${header}`, timeoutMs: 1000, expectOk: false },
  { cmd: "1003", desc: "Open extended diagnostic session", timeoutMs: 2500, expectOk: true },
  { cmd: "3E00", desc: "Tester-present keepalive", timeoutMs: 1000, expectOk: false },
  { cmd: `3101${routine}`, desc: `Start routine ${routine}`, timeoutMs: 7000, expectOk: true },
  { cmd: `3103${routine}`, desc: `Request routine ${routine} result`, timeoutMs: 4000, expectOk: false },
  { cmd: "1001", desc: "Return to default session", timeoutMs: 1000, expectOk: false },
];

const standard = (header: string, commands: OBDCommandStep[]): OBDCommandStep[] => [
  { cmd: `ATSH ${header}`, desc: `Select module ${header}`, timeoutMs: 1000, expectOk: false },
  ...commands,
  { cmd: "1001", desc: "Return to default session", timeoutMs: 1000, expectOk: false },
];

export const SERVICE_RESETS: ServiceReset[] = [
  {
    id: "oil_reset", name: "Oil Life Reset", description: "Run an OEM service-interval reset routine after an oil change.", category: "Engine", icon: "droplet", dangerous: false, moduleAddr: "7E0",
    steps: ["Ignition ON, engine OFF", "Verify the oil change is complete", "Run the reset routine", "Cycle ignition and confirm the reminder is cleared"],
    obdCommands: udsRoutine("7E0", "FF00"),
  },
  {
    id: "throttle_relearn", name: "Throttle Body Relearn", description: "Start the throttle/idle air adaptation routine after cleaning or replacement.", category: "Engine", icon: "activity", dangerous: false, requiresEngineOff: true, moduleAddr: "7E0",
    steps: ["Ignition ON, engine OFF", "Do not touch accelerator", "Run routine", "Start and idle until stable"],
    obdCommands: udsRoutine("7E0", "FF01"),
  },
  {
    id: "idle_relearn", name: "Idle Speed Relearn", description: "Reset learned idle trim and start idle stabilization.", category: "Engine", icon: "sliders", dangerous: false, requiresEngineOn: true, moduleAddr: "7E0",
    steps: ["Engine warm", "A/C and accessories OFF", "Run routine", "Idle three minutes without throttle input"],
    obdCommands: udsRoutine("7E0", "FF02"),
  },
  {
    id: "evap_reset", name: "EVAP Monitor Reset", description: "Clear emission readiness state and request EVAP monitor preparation.", category: "Engine", icon: "cloud", dangerous: false, moduleAddr: "7E0",
    steps: ["Repair EVAP faults first", "Run command", "Complete the required drive cycle", "Verify Mode 01 PID 01 readiness"],
    obdCommands: standard("7E0", [
      { cmd: "04", desc: "Clear emission diagnostic information/readiness", timeoutMs: 5000, expectOk: true },
      { cmd: "0101", desc: "Read monitor status", timeoutMs: 3000, expectOk: false },
    ]),
  },
  {
    id: "injector_reset", name: "Fuel Trim / Injector Adaptation Reset", description: "Request reset of fuel correction/adaptive values.", category: "Engine", icon: "zap", dangerous: false, moduleAddr: "7E0",
    steps: ["Repair fuel/air faults first", "Run reset", "Idle until closed loop", "Complete a light drive cycle"],
    obdCommands: udsRoutine("7E0", "FF03"),
  },
  {
    id: "maf_reset", name: "MAF Adaptation Reset", description: "Reset air-flow adaptive learning after MAF service.", category: "Engine", icon: "wind", dangerous: false, moduleAddr: "7E0",
    steps: ["Install/clean MAF", "Ignition ON", "Run reset", "Drive lightly for relearn"],
    obdCommands: udsRoutine("7E0", "FF04"),
  },
  {
    id: "trans_adaptive", name: "Transmission Adaptive Reset", description: "Clear shift adaptive data and begin relearn.", category: "Transmission", icon: "git-branch", dangerous: true, moduleAddr: "7E1",
    warning: "Vehicle may shift harshly until relearn is complete. Drive gently after reset.",
    steps: ["Fluid level correct", "Vehicle parked", "Run reset", "Perform manufacturer relearn drive cycle"],
    obdCommands: udsRoutine("7E1", "FF10"),
  },
  {
    id: "tcc_reset", name: "TCC Adaptation Reset", description: "Reset torque converter clutch slip adaptation.", category: "Transmission", icon: "settings", dangerous: false, moduleAddr: "7E1",
    steps: ["Transmission warm", "Run reset", "Road test at steady cruise", "Verify no TCC codes return"],
    obdCommands: udsRoutine("7E1", "FF11"),
  },
  {
    id: "epb_retract", name: "EPB Retract Service Mode", description: "Command electric park brake motors into service position.", category: "Brakes", icon: "unlock", dangerous: true, requiresEngineOff: true, moduleAddr: "760",
    warning: "Chock wheels. The vehicle can roll when EPB is retracted.",
    steps: ["Park on level surface", "Chock wheels", "Run retract", "Replace rear pads", "Run EPB Apply when finished"],
    obdCommands: udsRoutine("760", "F100"),
  },
  {
    id: "epb_apply", name: "EPB Apply / Exit Service Mode", description: "Seat EPB motors after rear brake service.", category: "Brakes", icon: "lock", dangerous: true, moduleAddr: "760",
    warning: "Confirm pads and calipers are correctly installed before applying EPB.",
    steps: ["Confirm brake hardware installed", "Run apply", "Pump brake pedal", "Verify EPB applies/releases normally"],
    obdCommands: udsRoutine("760", "F101"),
  },
  {
    id: "abs_bleed", name: "ABS Pump Bleeding", description: "Cycle ABS pump/solenoid bleed routine.", category: "Brakes", icon: "droplet", dangerous: true, moduleAddr: "760",
    warning: "Do not run a dry ABS pump. Follow proper brake bleeding procedure.",
    steps: ["Fill reservoir", "Attach bleed hose", "Run routine", "Top up fluid and repeat as needed"],
    obdCommands: udsRoutine("760", "F102"),
  },
  {
    id: "brake_wear_reset", name: "Brake Wear Indicator Reset", description: "Reset brake pad wear/service indicator.", category: "Brakes", icon: "disc", dangerous: false, moduleAddr: "760",
    steps: ["Install new wear sensors", "Run reset", "Cycle ignition", "Verify warning is cleared"],
    obdCommands: udsRoutine("760", "F103"),
  },
  {
    id: "steering_angle", name: "Steering Angle Calibration", description: "Start steering angle sensor zero-point calibration.", category: "Steering", icon: "navigation", dangerous: false, requiresEngineOn: true, moduleAddr: "7C0",
    steps: ["Wheels straight", "Flat level surface", "Run calibration", "Drive slowly straight to confirm"],
    obdCommands: udsRoutine("7C0", "F200"),
  },
  {
    id: "eps_reset", name: "EPS Torque Sensor Reset", description: "Reset EPS torque sensor zero calibration.", category: "Steering", icon: "refresh-cw", dangerous: false, moduleAddr: "7C0",
    steps: ["Steering centered", "Hands off wheel", "Run routine", "Verify assist is normal"],
    obdCommands: udsRoutine("7C0", "F201"),
  },
  {
    id: "tpms_relearn", name: "TPMS Sensor Relearn", description: "Start TPMS receiver learn mode.", category: "Tires", icon: "circle", dangerous: false, moduleAddr: "726",
    steps: ["Set tire pressures", "Run learn mode", "Trigger sensors FL/FR/RR/RL", "Verify IDs are stored"],
    obdCommands: udsRoutine("726", "F300"),
  },
  {
    id: "tpms_pressure_reset", name: "TPMS Pressure Baseline", description: "Store current tire pressures as baseline.", category: "Tires", icon: "trending-up", dangerous: false, moduleAddr: "726",
    steps: ["Inflate all tires to placard", "Run reset", "Drive until TPMS confirms", "Check warning lamp"],
    obdCommands: udsRoutine("726", "F301"),
  },
  {
    id: "window_calibration", name: "Window Auto-Up Calibration", description: "Start body control window position calibration.", category: "Body", icon: "square", dangerous: false, moduleAddr: "726",
    steps: ["Close all doors", "Run calibration", "Cycle each window fully down/up", "Test one-touch operation"],
    obdCommands: udsRoutine("726", "F400"),
  },
  {
    id: "sunroof_calibration", name: "Sunroof Calibration", description: "Start sunroof position relearn routine.", category: "Body", icon: "sun", dangerous: false, moduleAddr: "726",
    steps: ["Close sunroof", "Run calibration", "Let roof complete cycle", "Verify tilt/slide limits"],
    obdCommands: udsRoutine("726", "F401"),
  },
  {
    id: "battery_registration", name: "Battery Registration", description: "Request battery replacement registration routine.", category: "Battery", icon: "battery-charging", dangerous: false, moduleAddr: "726",
    steps: ["Install correct battery", "Run registration", "Cycle ignition", "Verify charging voltage"],
    obdCommands: udsRoutine("726", "F500"),
  },
  {
    id: "alternator_reset", name: "Charging System Reset", description: "Reset charging-system learned values.", category: "Battery", icon: "zap", dangerous: false, moduleAddr: "726",
    steps: ["Battery healthy", "Run reset", "Idle 10 minutes", "Verify 13.8–14.8V charging"],
    obdCommands: udsRoutine("726", "F501"),
  },
  {
    id: "hvac_blend", name: "HVAC Blend Door Calibration", description: "Start HVAC actuator end-stop calibration.", category: "HVAC", icon: "thermometer", dangerous: false, requiresEngineOn: false, moduleAddr: "733",
    steps: ["HVAC off", "Run calibration", "Wait for doors to cycle", "Test all zones"],
    obdCommands: udsRoutine("733", "F600"),
  },
  {
    id: "ac_service", name: "A/C Service Reset", description: "Reset HVAC A/C service counter/learned state.", category: "HVAC", icon: "wind", dangerous: false, moduleAddr: "733",
    steps: ["Complete A/C service", "Run reset", "Cycle ignition", "Verify A/C operation"],
    obdCommands: udsRoutine("733", "F601"),
  },
];
