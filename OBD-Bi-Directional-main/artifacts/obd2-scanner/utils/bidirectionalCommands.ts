/**
 * Bi-directional actuator test commands.
 * command field = actual OBD2 / ELM327 string sent over BT.
 *
 * Most actuator tests use UDS Service 0x2F (InputOutputControlByIdentifier)
 * or SAE J1979 Mode 08 (control on-board system).
 *
 * Format for Mode 2F:
 *   2F [2-byte DID] [controlOptionRecord] [controlEnableRecord]
 *   e.g. 2F 0200 03 01 = activate cooling fan relay
 *
 * "Return to ECU control" is sent automatically after duration.
 */

export interface BiDiCommand {
  id: string;
  name: string;
  description: string;
  category: string;
  command: string;         // activate command
  offCommand?: string;     // deactivate / return to ECU control
  moduleAddr?: string;     // ELM327 ATSH header (default 7E0 = ECM)
  dangerous: boolean;
  duration: number;        // ms to hold before auto-off
  icon: string;
}

export const CATEGORIES = [
  "Cooling",
  "Fuel System",
  "Emissions",
  "Ignition",
  "Transmission",
  "HVAC",
  "Suspension",
  "Injection",
];

export const BIDI_COMMANDS: BiDiCommand[] = [
  // ── COOLING ──────────────────────────────────────────────────────────────────
  {
    id: "fan_low",
    name: "Cooling Fan Low",
    description: "Activate radiator cooling fan at low speed via ECM relay output",
    category: "Cooling",
    command: "2F020003FF",        // DID 0200 = cooling fan; 03=short-term adj; FF=100%
    offCommand: "2F020000",       // return to ECM control
    moduleAddr: "7E0",
    dangerous: false,
    duration: 5000,
    icon: "wind",
  },
  {
    id: "fan_high",
    name: "Cooling Fan High",
    description: "Activate radiator cooling fan at high speed (both relays)",
    category: "Cooling",
    command: "2F020103FF",
    offCommand: "2F020100",
    moduleAddr: "7E0",
    dangerous: false,
    duration: 5000,
    icon: "wind",
  },
  {
    id: "coolant_thermostat",
    name: "Thermostat Test",
    description: "Command electronic thermostat fully open to verify operation",
    category: "Cooling",
    command: "2F020203FF",
    offCommand: "2F020200",
    moduleAddr: "7E0",
    dangerous: false,
    duration: 8000,
    icon: "thermometer",
  },

  // ── FUEL SYSTEM ──────────────────────────────────────────────────────────────
  {
    id: "fuel_pump",
    name: "Fuel Pump Prime",
    description: "Activate fuel pump relay for 5 seconds — pressurizes system for leak testing",
    category: "Fuel System",
    command: "2F030003FF",        // DID 0300 = fuel pump relay
    offCommand: "2F030000",
    moduleAddr: "7E0",
    dangerous: false,
    duration: 5000,
    icon: "droplet",
  },
  {
    id: "injector_1",
    name: "Injector #1 Test",
    description: "Fire injector 1 in short-pulse test mode to check operation",
    category: "Injection",
    command: "2F040003C8",        // DID 0400 = inj 1; C8 = 50% duty
    offCommand: "2F040000",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 3000,
    icon: "zap",
  },
  {
    id: "injector_2",
    name: "Injector #2 Test",
    description: "Fire injector 2 in short-pulse test mode",
    category: "Injection",
    command: "2F040103C8",
    offCommand: "2F040100",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 3000,
    icon: "zap",
  },
  {
    id: "injector_3",
    name: "Injector #3 Test",
    description: "Fire injector 3 in short-pulse test mode",
    category: "Injection",
    command: "2F040203C8",
    offCommand: "2F040200",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 3000,
    icon: "zap",
  },
  {
    id: "injector_4",
    name: "Injector #4 Test",
    description: "Fire injector 4 in short-pulse test mode",
    category: "Injection",
    command: "2F040303C8",
    offCommand: "2F040300",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 3000,
    icon: "zap",
  },
  {
    id: "purge_valve",
    name: "EVAP Purge Valve",
    description: "Open EVAP canister purge valve to test solenoid operation",
    category: "Emissions",
    command: "2F050003FF",        // DID 0500 = EVAP purge
    offCommand: "2F050000",
    moduleAddr: "7E0",
    dangerous: false,
    duration: 4000,
    icon: "cloud",
  },
  {
    id: "vent_valve",
    name: "EVAP Vent Valve",
    description: "Close EVAP vent valve to seal system for pressure testing",
    category: "Emissions",
    command: "2F050103FF",
    offCommand: "2F050100",
    moduleAddr: "7E0",
    dangerous: false,
    duration: 4000,
    icon: "cloud",
  },
  {
    id: "egr_valve",
    name: "EGR Valve",
    description: "Command EGR valve to full open — listen for idle change to confirm operation",
    category: "Emissions",
    command: "2F050203FF",
    offCommand: "2F050200",
    moduleAddr: "7E0",
    dangerous: false,
    duration: 5000,
    icon: "cloud",
  },

  // ── IGNITION ─────────────────────────────────────────────────────────────────
  {
    id: "coil_1",
    name: "Ignition Coil #1",
    description: "Fire coil on cylinder 1 to confirm spark output",
    category: "Ignition",
    command: "2F060003FF",
    offCommand: "2F060000",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 2000,
    icon: "zap",
  },
  {
    id: "coil_2",
    name: "Ignition Coil #2",
    description: "Fire coil on cylinder 2 to confirm spark output",
    category: "Ignition",
    command: "2F060103FF",
    offCommand: "2F060100",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 2000,
    icon: "zap",
  },
  {
    id: "coil_3",
    name: "Ignition Coil #3",
    description: "Fire coil on cylinder 3 to confirm spark output",
    category: "Ignition",
    command: "2F060203FF",
    offCommand: "2F060200",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 2000,
    icon: "zap",
  },
  {
    id: "coil_4",
    name: "Ignition Coil #4",
    description: "Fire coil on cylinder 4 to confirm spark output",
    category: "Ignition",
    command: "2F060303FF",
    offCommand: "2F060300",
    moduleAddr: "7E0",
    dangerous: true,
    duration: 2000,
    icon: "zap",
  },

  // ── TRANSMISSION ─────────────────────────────────────────────────────────────
  {
    id: "trans_line_pressure",
    name: "Trans Line Pressure",
    description: "Command TCM to maximum line pressure for pressure testing",
    category: "Transmission",
    command: "2F070003FF",
    offCommand: "2F070000",
    moduleAddr: "7E1",
    dangerous: true,
    duration: 5000,
    icon: "settings",
  },
  {
    id: "trans_shift_sol_a",
    name: "Shift Solenoid A",
    description: "Energize shift solenoid A independently to verify operation",
    category: "Transmission",
    command: "2F070103FF",
    offCommand: "2F070100",
    moduleAddr: "7E1",
    dangerous: false,
    duration: 3000,
    icon: "settings",
  },
  {
    id: "trans_shift_sol_b",
    name: "Shift Solenoid B",
    description: "Energize shift solenoid B independently to verify operation",
    category: "Transmission",
    command: "2F070203FF",
    offCommand: "2F070200",
    moduleAddr: "7E1",
    dangerous: false,
    duration: 3000,
    icon: "settings",
  },
  {
    id: "tcc_solenoid",
    name: "TCC Solenoid",
    description: "Engage torque converter clutch solenoid to verify operation",
    category: "Transmission",
    command: "2F070303FF",
    offCommand: "2F070300",
    moduleAddr: "7E1",
    dangerous: false,
    duration: 3000,
    icon: "settings",
  },

  // ── HVAC ─────────────────────────────────────────────────────────────────────
  {
    id: "ac_compressor",
    name: "A/C Compressor Clutch",
    description: "Engage A/C compressor clutch relay to test operation",
    category: "HVAC",
    command: "2F080003FF",
    offCommand: "2F080000",
    moduleAddr: "7C0",
    dangerous: false,
    duration: 5000,
    icon: "thermometer",
  },
  {
    id: "blend_door_hot",
    name: "Blend Door → Full Hot",
    description: "Command blend door actuator to max heat position",
    category: "HVAC",
    command: "2F080103FF",
    offCommand: "2F080100",
    moduleAddr: "7C0",
    dangerous: false,
    duration: 5000,
    icon: "thermometer",
  },
  {
    id: "blend_door_cold",
    name: "Blend Door → Full Cold",
    description: "Command blend door actuator to max cold position",
    category: "HVAC",
    command: "2F080200FF",
    offCommand: "2F080200",
    moduleAddr: "7C0",
    dangerous: false,
    duration: 5000,
    icon: "thermometer",
  },

  // ── SUSPENSION ───────────────────────────────────────────────────────────────
  {
    id: "abs_pump_motor",
    name: "ABS Pump Motor",
    description: "Run ABS hydraulic pump motor briefly to check operation (used during brake bleed)",
    category: "Suspension",
    command: "2F090003FF",
    offCommand: "2F090000",
    moduleAddr: "760",
    dangerous: true,
    duration: 3000,
    icon: "disc",
  },
  {
    id: "abs_sol_fl",
    name: "ABS Solenoid FL",
    description: "Cycle front-left ABS solenoid to verify valve operation",
    category: "Suspension",
    command: "2F090103FF",
    offCommand: "2F090100",
    moduleAddr: "760",
    dangerous: false,
    duration: 2000,
    icon: "disc",
  },
  {
    id: "abs_sol_fr",
    name: "ABS Solenoid FR",
    description: "Cycle front-right ABS solenoid to verify valve operation",
    category: "Suspension",
    command: "2F090203FF",
    offCommand: "2F090200",
    moduleAddr: "760",
    dangerous: false,
    duration: 2000,
    icon: "disc",
  },
];
