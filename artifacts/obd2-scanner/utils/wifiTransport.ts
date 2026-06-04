/**
 * WiFi TCP transport for ELM327 adapters.
 *
 * Most WiFi ELM327 adapters create their own hotspot:
 *   SSID: something like "OBDII", "ELM327", "WiFi_OBDII"
 *   Default IP:   192.168.0.10  (some use 192.168.1.1)
 *   Default port: 35000         (some use 23)
 *
 * The OBD2 protocol over WiFi is byte-for-byte identical to Bluetooth —
 * plain ASCII text commands, responses terminated with '>'.
 *
 * This class mirrors the BluetoothTransport API so OBD2Context can
 * swap between the two with zero protocol-layer changes.
 *
 * Requires: react-native-tcp-socket
 */

import TcpSocket from "react-native-tcp-socket";

export class WiFiTransport {
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private buffer = "";
  private pendingResolve: ((data: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private writeQueue: Promise<string> = Promise.resolve("");
  _disconnected = false;

  /** Connect to the ELM327 WiFi adapter at host:port */
  async connect(host: string, port: number, connectTimeoutMs = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`WiFi connect timeout (${connectTimeoutMs}ms) — check adapter IP and port`));
      }, connectTimeoutMs);

      try {
        this.socket = TcpSocket.createConnection({ host, port, tls: false }, () => {
          clearTimeout(timer);
          this._disconnected = false;
          resolve();
        });

        // Handle incoming data — ELM327 terminates every response with '>'
        this.socket.on("data", (rawData: Buffer | string) => {
          // Normalize to string regardless of what react-native-tcp-socket gives us
          const chunk =
            typeof rawData === "string"
              ? rawData
              : rawData.toString("utf8");
          this.buffer += chunk;
          if (this.buffer.includes(">") && this.pendingResolve) {
            this._settle(null);
          }
        });

        this.socket.on("error", (err: Error) => {
          clearTimeout(timer);
          if (!this._disconnected) {
            // Reject any pending command
            if (this.pendingReject) {
              this.pendingReject(err);
              this.pendingResolve = null;
              this.pendingReject = null;
            }
            reject(err);
          }
        });

        this.socket.on("close", () => {
          this._disconnected = true;
          if (this.pendingReject) {
            this.pendingReject(new Error("WiFi connection closed"));
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        });
      } catch (err: any) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  /** Send a command string and wait for the '>' prompt response */
  send(cmd: string, timeoutMs = 3000): Promise<string> {
    // Serialize commands — ELM327 is request/response, never concurrent
    this.writeQueue = this.writeQueue.then(() =>
      this._sendOne(cmd, timeoutMs)
    );
    return this.writeQueue;
  }

  private _sendOne(cmd: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this._disconnected) {
        reject(new Error("WiFi transport not connected"));
        return;
      }

      this.buffer = "";
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      this.pendingTimeout = setTimeout(() => {
        this._settle(new Error(`Timeout waiting for response to: ${cmd}`));
      }, timeoutMs);

      // ELM327 commands must end with CR
      this.socket.write(cmd + "\r", "utf8", (err?: Error | null) => {
        if (err) this._settle(err);
      });
    });
  }

  private _settle(err: Error | null) {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    const resolve = this.pendingResolve;
    const reject = this.pendingReject;
    this.pendingResolve = null;
    this.pendingReject = null;

    if (err) {
      reject?.(err);
    } else {
      // Strip the trailing '>' prompt and clean up whitespace
      const response = this.buffer
        .replace(/>/g, "")
        .replace(/\r/g, "\n")
        .trim();
      this.buffer = "";
      resolve?.(response);
    }
  }

  isConnected(): boolean {
    return this.socket !== null && !this._disconnected;
  }

  async disconnect(): Promise<void> {
    this._disconnected = true;
    if (this.pendingTimeout !== null) clearTimeout(this.pendingTimeout);
    if (this.pendingReject) {
      this.pendingReject(new Error("Disconnected"));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
    this.buffer = "";
    try { this.socket?.destroy(); } catch {}
    this.socket = null;
  }
}
