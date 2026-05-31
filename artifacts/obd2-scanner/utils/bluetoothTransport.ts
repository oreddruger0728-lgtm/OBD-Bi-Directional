/**
 * Bluetooth Classic transport for ELM327 adapters.
 * Wraps react-native-bluetooth-classic with buffered serial I/O.
 *
 * The ELM327 uses a request-response model:
 *   - App sends: "010C\r"
 *   - ELM327 sends back: "41 0C 1A F8\r\n>" (response + prompt)
 * We buffer incoming bytes and resolve the pending promise when '>' is seen.
 */

import { Platform } from "react-native";

// ── Module availability guard ─────────────────────────────────────────────────
// react-native-bluetooth-classic requires a custom build (not Expo Go).
// We load it lazily so the app doesn't crash in Expo Go.
let RNBluetooth: any = null;
let btLoadAttempted = false;

function getBTModule(): any | null {
  if (!btLoadAttempted) {
    btLoadAttempted = true;
    try {
      RNBluetooth = require("react-native-bluetooth-classic").default;
    } catch {
      RNBluetooth = null;
    }
  }
  return RNBluetooth;
}

export function isBluetoothClassicAvailable(): boolean {
  if (Platform.OS === "web") return false;
  return getBTModule() !== null;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BTDevice {
  address: string;
  name: string;
  bonded: boolean;
}

// ── Bluetooth transport ───────────────────────────────────────────────────────
export class BluetoothTransport {
  private device: any = null;
  private dataSubscription: any = null;
  private buffer = "";
  private pendingResolve: ((data: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Static helpers ──────────────────────────────────────────────────────────

  static async isEnabled(): Promise<boolean> {
    const bt = getBTModule();
    if (!bt) return false;
    try {
      return await bt.isBluetoothEnabled();
    } catch {
      return false;
    }
  }

  static async requestEnable(): Promise<boolean> {
    const bt = getBTModule();
    if (!bt) return false;
    try {
      return await bt.requestBluetoothEnabled();
    } catch {
      return false;
    }
  }

  /** Returns all bonded (paired) devices — no discovery needed for ELM327. */
  static async getBondedDevices(): Promise<BTDevice[]> {
    const bt = getBTModule();
    if (!bt) throw new Error("Bluetooth Classic is not available. Build a custom APK to enable it.");
    try {
      const devices = await bt.getBondedDevices();
      return (devices as any[]).map((d) => ({
        address: d.address,
        name: d.name ?? d.address,
        bonded: true,
      }));
    } catch (e: any) {
      throw new Error("Failed to list paired devices: " + (e?.message ?? String(e)));
    }
  }

  // ── Instance methods ────────────────────────────────────────────────────────

  async connect(address: string): Promise<void> {
    const bt = getBTModule();
    if (!bt) throw new Error("Bluetooth Classic is not available. Build a custom APK to enable it.");

    this.buffer = "";

    // Connect — ELM327 uses default SPP params
    const devices = await bt.getBondedDevices();
    const target = (devices as any[]).find((d: any) => d.address === address);
    if (!target) throw new Error(`Device ${address} not found in paired devices`);

    this.device = await target.connect({ delimiter: "\r" });

    // Subscribe to incoming data
    this.dataSubscription = this.device.onDataReceived(({ data }: { data: string }) => {
      this.buffer += data;
      // ELM327 terminates each response with the '>' prompt
      if (this.buffer.includes(">") && this.pendingResolve) {
        this._settle(null);
      }
    });
  }

  private _settle(err: Error | null) {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    if (err) {
      const rej = this.pendingReject;
      this.pendingResolve = null;
      this.pendingReject = null;
      rej?.(err);
    } else {
      const response = this.buffer.split(">")[0].replace(/[\r\n]+/g, " ").trim();
      this.buffer = "";
      const res = this.pendingResolve;
      this.pendingResolve = null;
      this.pendingReject = null;
      res?.(response);
    }
  }

  /**
   * Send a command string (without the \r — we add it) and wait for the
   * ELM327 '>' prompt. Returns the response text.
   */
  send(command: string, timeoutMs = 3000): Promise<string> {
    if (!this.device) return Promise.reject(new Error("Not connected"));

    return new Promise<string>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.buffer = "";

      this.pendingTimeout = setTimeout(() => {
        this._settle(new Error(`Timeout waiting for response to: ${command}`));
      }, timeoutMs);

      this.device.write(command + "\r").catch((e: any) => {
        this._settle(new Error("Write failed: " + (e?.message ?? String(e))));
      });
    });
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  async disconnect(): Promise<void> {
    this.pendingTimeout !== null && clearTimeout(this.pendingTimeout);
    this.dataSubscription?.remove();
    this.dataSubscription = null;
    this.pendingResolve = null;
    this.pendingReject = null;
    this.buffer = "";
    try { await this.device?.disconnect(); } catch {}
    this.device = null;
  }
}
