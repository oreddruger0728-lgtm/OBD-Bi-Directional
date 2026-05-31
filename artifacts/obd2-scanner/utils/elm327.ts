/**
 * ELM327 protocol utilities — AT command builder, PID table, response parser.
 * All communication is plain text over a serial (BT/WiFi) connection.
 * Commands end with '\r'. Responses end with '>'.
 */

// ── AT Init sequence ──────────────────────────────────────────────────────────
export const ELM327_INIT_COMMANDS = [
  { cmd: "ATZ",    desc: "Reset adapter",              delayMs: 1500 },
  { cmd: "ATE0",   desc: "Echo off",                   delayMs: 200 },
  { cmd: "ATL0",   desc: "Linefeeds off",              delayMs: 200 },
  { cmd: "ATS0",   desc: "Spaces off",                 delayMs: 200 },
  { cmd: "ATH1",   desc: "Headers on",                 delayMs: 200 },
  { cmd: "ATSP0",  desc: "Auto protocol detect",       delayMs: 500 },
];

// ── PID definitions ───────────────────────────────────────────────────────────
export interface PIDDef {
  cmd: string;           // full OBD2 command string e.g. "010C"
  name: keyof import("./pidNames").PIDDataKeys;
  bytes: number;         // expected data bytes in response
  parse: (...args: number[]) => number;
}

// All standard OBD2 Mode 01 PIDs used for live data
export const LIVE_PIDS: PIDDef[] = [
  {
    cmd: "010C",
    name: "rpm",
    bytes: 2,
    parse: (a, b) => ((a * 256) + b) / 4,
  },
  {
    cmd: "010D",
    name: "speed",
    bytes: 1,
    parse: (a) => a,
  },
  {
    cmd: "0105",
    name: "coolantTemp",
    bytes: 1,
    parse: (a) => a - 40,
  },
  {
    cmd: "0111",
    name: "throttle",
    bytes: 1,
    parse: (a) => parseFloat(((a / 255) * 100).toFixed(1)),
  },
  {
    cmd: "0104",
    name: "engineLoad",
    bytes: 1,
    parse: (a) => parseFloat(((a / 255) * 100).toFixed(1)),
  },
  {
    cmd: "012F",
    name: "fuelLevel",
    bytes: 1,
    parse: (a) => parseFloat(((a / 255) * 100).toFixed(1)),
  },
  {
    cmd: "0142",
    name: "batteryVoltage",
    bytes: 2,
    parse: (a, b) => parseFloat((((a * 256) + b) / 1000).toFixed(2)),
  },
  {
    cmd: "010F",
    name: "intakeTemp",
    bytes: 1,
    parse: (a) => a - 40,
  },
  {
    cmd: "015C",
    name: "oilTemp",
    bytes: 1,
    parse: (a) => a - 40,
  },
  {
    cmd: "010B",
    name: "map",
    bytes: 1,
    parse: (a) => a,
  },
  {
    cmd: "0110",
    name: "maf",
    bytes: 2,
    parse: (a, b) => parseFloat((((a * 256) + b) / 100).toFixed(2)),
  },
  {
    cmd: "010E",
    name: "timingAdvance",
    bytes: 1,
    parse: (a) => parseFloat((a / 2 - 64).toFixed(1)),
  },
  {
    cmd: "0106",
    name: "stftB1",
    bytes: 1,
    parse: (a) => parseFloat((((a - 128) * 100) / 128).toFixed(1)),
  },
  {
    cmd: "0107",
    name: "ltftB1",
    bytes: 1,
    parse: (a) => parseFloat((((a - 128) * 100) / 128).toFixed(1)),
  },
  {
    cmd: "0114",
    name: "o2B1S1",
    bytes: 2,
    parse: (a) => parseFloat((a / 200).toFixed(3)),
  },
  {
    cmd: "0133",
    name: "baroPress",
    bytes: 1,
    parse: (a) => a,
  },
  {
    cmd: "0146",
    name: "ambientTemp",
    bytes: 1,
    parse: (a) => a - 40,
  },
  {
    cmd: "011F",
    name: "runTime",
    bytes: 2,
    parse: (a, b) => (a * 256) + b,
  },
];

// ── Response parser ───────────────────────────────────────────────────────────
/**
 * Parse a raw ELM327 response string for a given mode+pid.
 * Returns the numeric value or null on error/no data.
 *
 * Example raw response for 010C (RPM):
 *   "41 0C 1A F8" or "410C1AF8" (spaces off with ATS0)
 */
export function parseResponse(raw: string, pid: PIDDef): number | null {
  if (!raw) return null;

  const clean = raw
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/>/g, "")
    .trim()
    .toUpperCase();

  // Check for no-data responses
  if (
    clean.includes("NO DATA") ||
    clean.includes("UNABLE TO CONNECT") ||
    clean.includes("BUS INIT") ||
    clean.includes("ERROR") ||
    clean.includes("STOPPED") ||
    clean === ""
  ) {
    return null;
  }

  // Strip any header frames (7E8, 7EA etc.) if headers were accidentally on
  // Normalize — remove all whitespace
  const hex = clean.replace(/\s+/g, "");

  // Expected positive response: mode+0x40, pid, then data bytes
  // e.g. for "010C": response starts with "410C"
  const mode = pid.cmd.substring(0, 2);
  const pidHex = pid.cmd.substring(2, 4);
  const responseHeader = (parseInt(mode, 16) + 0x40).toString(16).toUpperCase().padStart(2, "0") + pidHex.toUpperCase();

  const headerIdx = hex.indexOf(responseHeader);
  if (headerIdx === -1) return null;

  const dataStart = headerIdx + responseHeader.length;
  const dataHex = hex.substring(dataStart, dataStart + pid.bytes * 2);

  if (dataHex.length < pid.bytes * 2) return null;

  const bytes: number[] = [];
  for (let i = 0; i < pid.bytes; i++) {
    const byteHex = dataHex.substring(i * 2, i * 2 + 2);
    const val = parseInt(byteHex, 16);
    if (isNaN(val)) return null;
    bytes.push(val);
  }

  try {
    return pid.parse(...bytes);
  } catch {
    return null;
  }
}

// ── DTC parser ────────────────────────────────────────────────────────────────
/**
 * Parse raw Mode 03 response into DTC code strings.
 * Response: "43 01 43 00 00 00 00" — byte pairs after "43"
 */
export function parseDTCResponse(raw: string): string[] {
  if (!raw) return [];
  const clean = raw.replace(/\s/g, "").toUpperCase();
  if (!clean.includes("43")) return [];

  const idx = clean.indexOf("43");
  const dataHex = clean.substring(idx + 2);

  const dtcs: string[] = [];
  for (let i = 0; i + 3 < dataHex.length; i += 4) {
    const pair = dataHex.substring(i, i + 4);
    if (pair === "0000") continue;

    const firstNibble = parseInt(pair[0], 16);
    const prefix = ["P", "C", "B", "U"][firstNibble >> 2] ?? "P";
    const digits = ((firstNibble & 0x03).toString() + pair.substring(1)).toUpperCase();
    dtcs.push(prefix + digits);
  }
  return dtcs;
}

// ── VIN reader ────────────────────────────────────────────────────────────────
/** Mode 09 PID 02 — returns raw hex to be decoded as ASCII */
export const VIN_CMD = "0902";

export function parseVINResponse(raw: string): string | null {
  const clean = raw.replace(/\r/g, "").replace(/\n/g, "").toUpperCase();
  // Response contains "49 02 01" + VIN bytes, may be multi-frame
  const hex = clean.replace(/\s+/g, "");
  const vinStartMarkers = ["490201", "4902"];
  for (const marker of vinStartMarkers) {
    const idx = hex.indexOf(marker);
    if (idx !== -1) {
      const vinHex = hex.substring(idx + marker.length).replace(/49020[0-9]/g, "");
      let vin = "";
      for (let i = 0; i + 1 < vinHex.length; i += 2) {
        const code = parseInt(vinHex.substring(i, i + 2), 16);
        if (code >= 32 && code <= 127) vin += String.fromCharCode(code);
      }
      if (vin.length >= 11) return vin.substring(0, 17);
    }
  }
  return null;
}

// ── Mode 02 — Freeze frame PIDs ──────────────────────────────────────────────
/**
 * Same PIDs as LIVE_PIDS but issued as Mode 02 (freeze frame) commands.
 * Command format: "02" + pid + "00" (frame 0). Response header: 0x02+0x40=0x42.
 * parseResponse works unchanged because it derives the response mode from cmd[0:2].
 */
export const FREEZE_FRAME_PIDS: PIDDef[] = LIVE_PIDS.map((p) => ({
  ...p,
  cmd: "02" + p.cmd.substring(2) + "00",
}));

// ── Supported PID check ───────────────────────────────────────────────────────
/** Check if a PID is supported by the ECU. Response to "0100" = bitmask. */
export function parseSupportedPIDs(raw: string): Set<string> {
  const supported = new Set<string>();
  const clean = raw.replace(/\s+/g, "").toUpperCase();
  const idx = clean.indexOf("4100");
  if (idx === -1) return supported;
  const bitmask = clean.substring(idx + 4, idx + 12);
  if (bitmask.length < 8) return supported;
  const num = parseInt(bitmask, 16);
  for (let i = 0; i < 32; i++) {
    if (num & (1 << (31 - i))) {
      supported.add((i + 1).toString(16).padStart(2, "0").toUpperCase());
    }
  }
  return supported;
}
