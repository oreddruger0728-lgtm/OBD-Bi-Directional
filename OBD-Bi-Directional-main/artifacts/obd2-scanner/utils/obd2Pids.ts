export interface PIDDef {
  pid: string;
  mode: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  decimals: number;
  color: string;
  warningHigh?: number;
  criticalHigh?: number;
  warningLow?: number;
  parse: (bytes: number[]) => number;
}

export const PIDS: Record<string, PIDDef> = {
  RPM: {
    pid: "0C",
    mode: "01",
    name: "RPM",
    unit: "rpm",
    min: 0,
    max: 8000,
    decimals: 0,
    color: "#00D4FF",
    warningHigh: 6000,
    criticalHigh: 7500,
    parse: (b) => ((b[0] * 256 + b[1]) / 4),
  },
  SPEED: {
    pid: "0D",
    mode: "01",
    name: "Speed",
    unit: "km/h",
    min: 0,
    max: 240,
    decimals: 0,
    color: "#A78BFA",
    parse: (b) => b[0],
  },
  COOLANT_TEMP: {
    pid: "05",
    mode: "01",
    name: "Coolant",
    unit: "°C",
    min: -40,
    max: 215,
    decimals: 0,
    color: "#FF6B6B",
    warningHigh: 100,
    criticalHigh: 110,
    parse: (b) => b[0] - 40,
  },
  THROTTLE: {
    pid: "11",
    mode: "01",
    name: "Throttle",
    unit: "%",
    min: 0,
    max: 100,
    decimals: 1,
    color: "#FFB800",
    parse: (b) => (b[0] * 100) / 255,
  },
  ENGINE_LOAD: {
    pid: "04",
    mode: "01",
    name: "Engine Load",
    unit: "%",
    min: 0,
    max: 100,
    decimals: 1,
    color: "#FB923C",
    warningHigh: 85,
    parse: (b) => (b[0] * 100) / 255,
  },
  FUEL_LEVEL: {
    pid: "2F",
    mode: "01",
    name: "Fuel Level",
    unit: "%",
    min: 0,
    max: 100,
    decimals: 0,
    color: "#00E87A",
    warningLow: 15,
    parse: (b) => (b[0] * 100) / 255,
  },
  BATTERY_VOLTAGE: {
    pid: "42",
    mode: "01",
    name: "Battery",
    unit: "V",
    min: 0,
    max: 16,
    decimals: 1,
    color: "#F59E0B",
    warningLow: 12.0,
    criticalHigh: 15.5,
    parse: (b) => (b[0] * 256 + b[1]) / 1000,
  },
  INTAKE_TEMP: {
    pid: "0F",
    mode: "01",
    name: "Intake Temp",
    unit: "°C",
    min: -40,
    max: 215,
    decimals: 0,
    color: "#60A5FA",
    warningHigh: 60,
    parse: (b) => b[0] - 40,
  },
  OIL_TEMP: {
    pid: "5C",
    mode: "01",
    name: "Oil Temp",
    unit: "°C",
    min: -40,
    max: 210,
    decimals: 0,
    color: "#EF4444",
    warningHigh: 130,
    criticalHigh: 150,
    parse: (b) => b[0] - 40,
  },
  MAP: {
    pid: "0B",
    mode: "01",
    name: "MAP",
    unit: "kPa",
    min: 0,
    max: 255,
    decimals: 0,
    color: "#34D399",
    parse: (b) => b[0],
  },
  MAF: {
    pid: "10",
    mode: "01",
    name: "MAF",
    unit: "g/s",
    min: 0,
    max: 655.35,
    decimals: 2,
    color: "#A78BFA",
    parse: (b) => (b[0] * 256 + b[1]) / 100,
  },
  TIMING_ADVANCE: {
    pid: "0E",
    mode: "01",
    name: "Timing Adv.",
    unit: "°",
    min: -64,
    max: 63.5,
    decimals: 1,
    color: "#F472B6",
    parse: (b) => b[0] / 2 - 64,
  },
  SHORT_FUEL_TRIM_B1: {
    pid: "06",
    mode: "01",
    name: "STFT B1",
    unit: "%",
    min: -100,
    max: 99.2,
    decimals: 1,
    color: "#6EE7B7",
    warningHigh: 15,
    warningLow: -15,
    parse: (b) => (b[0] - 128) * 100 / 128,
  },
  LONG_FUEL_TRIM_B1: {
    pid: "07",
    mode: "01",
    name: "LTFT B1",
    unit: "%",
    min: -100,
    max: 99.2,
    decimals: 1,
    color: "#93C5FD",
    warningHigh: 15,
    warningLow: -15,
    parse: (b) => (b[0] - 128) * 100 / 128,
  },
  O2_B1S1: {
    pid: "14",
    mode: "01",
    name: "O2 B1S1",
    unit: "V",
    min: 0,
    max: 1.275,
    decimals: 3,
    color: "#FCD34D",
    parse: (b) => b[0] / 200,
  },
  BARO_PRESSURE: {
    pid: "33",
    mode: "01",
    name: "Baro Press.",
    unit: "kPa",
    min: 0,
    max: 255,
    decimals: 0,
    color: "#94A3B8",
    parse: (b) => b[0],
  },
  AMBIENT_TEMP: {
    pid: "46",
    mode: "01",
    name: "Ambient Temp",
    unit: "°C",
    min: -40,
    max: 215,
    decimals: 0,
    color: "#7DD3FC",
    parse: (b) => b[0] - 40,
  },
  RUN_TIME: {
    pid: "1F",
    mode: "01",
    name: "Run Time",
    unit: "s",
    min: 0,
    max: 65535,
    decimals: 0,
    color: "#CBD5E1",
    parse: (b) => b[0] * 256 + b[1],
  },
};

export function getStatusColor(pid: PIDDef, value: number): string {
  if (pid.criticalHigh !== undefined && value >= pid.criticalHigh) return "#FF4444";
  if (pid.warningHigh !== undefined && value >= pid.warningHigh) return "#FFB800";
  if (pid.criticalHigh !== undefined) return "#FF4444";
  if (pid.warningLow !== undefined && value <= pid.warningLow) return "#FFB800";
  return "#00E87A";
}

export function parseOBDResponse(response: string, pid: PIDDef): number | null {
  try {
    const clean = response.replace(/\s/g, "").toUpperCase();
    const modeResponse = (parseInt(pid.mode, 16) + 0x40).toString(16).toUpperCase().padStart(2, "0");
    const idx = clean.indexOf(modeResponse + pid.pid.toUpperCase());
    if (idx === -1) return null;
    const dataStart = idx + 4;
    const byteCount = dataStart + 8 < clean.length ? 4 : 2;
    const bytes: number[] = [];
    for (let i = 0; i < byteCount; i += 2) {
      if (dataStart + i + 2 <= clean.length) {
        bytes.push(parseInt(clean.substring(dataStart + i, dataStart + i + 2), 16));
      }
    }
    if (bytes.length === 0) return null;
    return pid.parse(bytes);
  } catch {
    return null;
  }
}

export function buildCommand(mode: string, pid: string): string {
  return `${mode}${pid}\r`;
}
