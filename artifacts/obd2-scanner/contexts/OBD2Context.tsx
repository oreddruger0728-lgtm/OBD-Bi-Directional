import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { lookupDTC, type DTCEntry } from "@/utils/dtcDatabase";
import { VEHICLE_MODULES, type MisfireData, type VehicleModule } from "@/utils/modules";
import { getDemoReadiness, type ReadinessMonitor } from "@/utils/readinessMonitors";
import { decodeVIN, type VehicleSpecs } from "@/utils/vinDecoder";
import {
  BluetoothTransport,
  isBluetoothClassicAvailable,
  type BTDevice,
} from "@/utils/bluetoothTransport";
import { LIVE_PIDS, FREEZE_FRAME_PIDS, ELM327_INIT_COMMANDS, parseResponse, parseDTCResponse, parseVINResponse } from "@/utils/elm327";
import { parsePID01Response } from "@/utils/readinessMonitors";

export type ConnectionMode = "DEMO" | "WIFI" | "BT";
export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export interface LiveData {
  rpm: number | null; speed: number | null; coolantTemp: number | null;
  throttle: number | null; engineLoad: number | null; fuelLevel: number | null;
  batteryVoltage: number | null; intakeTemp: number | null; oilTemp: number | null;
  map: number | null; maf: number | null; timingAdvance: number | null;
  stftB1: number | null; ltftB1: number | null; o2B1S1: number | null;
  baroPress: number | null; ambientTemp: number | null; runTime: number | null;
}

export interface VehicleInfo {
  vin: string; protocol: string; ecuName: string;
  calibrationId: string; cvn: string; fuelType: string; obd2Support: string;
}

export interface FreezeFrameData {
  dtc: string; data: Partial<LiveData>; timestamp: Date;
}

export interface ModuleDTCResult {
  module: VehicleModule; dtcs: DTCEntry[]; scanned: boolean; scanning: boolean;
}

interface OBD2ContextValue {
  connectionStatus: ConnectionStatus;
  connectionMode: ConnectionMode;
  liveData: LiveData;
  dtcList: DTCEntry[];
  pendingDTCCount: number;
  moduleDTCs: ModuleDTCResult[];
  vehicleInfo: VehicleInfo | null;
  vehicleSpecs: VehicleSpecs | null;
  isDecodingVIN: boolean;
  freezeFrame: FreezeFrameData | null;
  dtcFreezeFrames: Record<string, FreezeFrameData>;
  fetchingFreezeFrames: Record<string, boolean>;
  readinessMonitors: ReadinessMonitor[];
  misfireCounters: MisfireData[];
  wifiHost: string;
  wifiPort: number;
  btDeviceAddress: string;
  btDeviceName: string;
  pairedDevices: BTDevice[];
  isScanningBT: boolean;
  btAvailable: boolean;
  activeTest: string | null;
  testResult: string | null;
  isScanning: boolean;
  isModuleScanning: boolean;
  cylinderCount: number;
  setConnectionMode: (mode: ConnectionMode) => void;
  setWifiHost: (h: string) => void;
  setWifiPort: (p: number) => void;
  setBTDevice: (address: string, name: string) => void;
  scanPairedDevices: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshDTCs: () => Promise<void>;
  clearDTCs: () => Promise<void>;
  scanAllModules: () => Promise<void>;
  clearModuleDTCs: () => Promise<void>;
  refreshFreezeFrame: () => Promise<void>;
  fetchFreezeFrame: (dtcCode: string) => Promise<void>;
  refreshVehicleInfo: () => Promise<void>;
  refreshReadiness: () => Promise<void>;
  refreshMisfires: () => Promise<void>;
  decodeVin: (vin: string) => Promise<void>;
  clearVehicleSpecs: () => void;
  runActuatorTest: (commandId: string, command: string) => Promise<void>;
  runServiceReset: (resetId: string) => Promise<{ success: boolean; message: string }>;
}

const EMPTY_LIVE_DATA: LiveData = {
  rpm: null, speed: null, coolantTemp: null, throttle: null,
  engineLoad: null, fuelLevel: null, batteryVoltage: null,
  intakeTemp: null, oilTemp: null, map: null, maf: null,
  timingAdvance: null, stftB1: null, ltftB1: null, o2B1S1: null,
  baroPress: null, ambientTemp: null, runTime: null,
};

const OBD2Context = createContext<OBD2ContextValue | null>(null);

// ── Demo state machine ────────────────────────────────────────────────────────
interface DemoState {
  rpm: number; speed: number; coolantTemp: number; oilTemp: number;
  throttle: number; fuelLevel: number; runTime: number;
  phase: "idle" | "accel" | "cruise" | "decel"; phaseTimer: number;
}

function createDemoState(): DemoState {
  return { rpm: 800, speed: 0, coolantTemp: 65, oilTemp: 60, throttle: 5, fuelLevel: 74.5, runTime: 0, phase: "idle", phaseTimer: 0 };
}

function tickDemo(prev: DemoState): { state: DemoState; data: LiveData } {
  const s = { ...prev };
  s.runTime += 1; s.phaseTimer++;
  switch (s.phase) {
    case "idle":
      if (s.phaseTimer > 20) { s.phase = Math.random() > 0.4 ? "accel" : "idle"; s.phaseTimer = 0; }
      s.rpm = 750 + Math.sin(s.runTime * 0.3) * 50 + Math.random() * 30;
      s.throttle = 4 + Math.random() * 2; s.speed = Math.max(0, s.speed - 2); break;
    case "accel":
      if (s.phaseTimer > 15) { s.phase = "cruise"; s.phaseTimer = 0; }
      s.throttle = Math.min(80, s.throttle + 5);
      s.rpm = Math.min(4500, s.rpm + 150 + Math.random() * 50);
      s.speed = Math.min(120, s.speed + 3); break;
    case "cruise":
      if (s.phaseTimer > 25) { s.phase = "decel"; s.phaseTimer = 0; }
      s.throttle = 18 + Math.sin(s.runTime * 0.1) * 5 + Math.random() * 3;
      s.rpm = 2100 + Math.sin(s.runTime * 0.2) * 200 + Math.random() * 100;
      s.speed = 85 + Math.sin(s.runTime * 0.05) * 10; break;
    case "decel":
      if (s.phaseTimer > 12) { s.phase = "idle"; s.phaseTimer = 0; }
      s.throttle = Math.max(3, s.throttle - 4);
      s.rpm = Math.max(800, s.rpm - 120 + Math.random() * 30);
      s.speed = Math.max(0, s.speed - 4); break;
  }
  if (s.coolantTemp < 88) s.coolantTemp += 0.15;
  if (s.oilTemp < 95) s.oilTemp += 0.1;
  s.fuelLevel = Math.max(0, s.fuelLevel - 0.00025);
  const engineLoad = Math.min(100, (s.rpm / 6000) * 100 * (s.throttle / 100) * 6);
  const maf = 1.0 + (s.rpm / 1000) * 2.5 + (s.throttle / 100) * 15;
  const mapVal = 30 + (s.throttle / 100) * 80 + Math.random() * 5;
  const timingAdv = 10 + (s.rpm / 1000) * 3 - (s.throttle / 100) * 5;
  const stft = 0.5 + Math.sin(s.runTime * 0.15) * 2.5 + Math.random() * 1;
  const ltft = 1.2 + Math.sin(s.runTime * 0.02) * 1.5;
  const o2 = 0.1 + Math.abs(Math.sin(s.runTime * 0.5)) * 0.8 + Math.random() * 0.1;
  const data: LiveData = {
    rpm: Math.round(s.rpm), speed: Math.round(s.speed),
    coolantTemp: Math.round(s.coolantTemp), oilTemp: Math.round(s.oilTemp),
    throttle: parseFloat(s.throttle.toFixed(1)),
    engineLoad: parseFloat(engineLoad.toFixed(1)),
    fuelLevel: parseFloat(s.fuelLevel.toFixed(1)),
    batteryVoltage: parseFloat((13.8 + Math.sin(s.runTime * 0.1) * 0.2 + Math.random() * 0.1).toFixed(1)),
    intakeTemp: parseFloat((22 + Math.sin(s.runTime * 0.05) * 3).toFixed(0)),
    map: parseFloat(mapVal.toFixed(0)), maf: parseFloat(maf.toFixed(2)),
    timingAdvance: parseFloat(timingAdv.toFixed(1)),
    stftB1: parseFloat(stft.toFixed(1)), ltftB1: parseFloat(ltft.toFixed(1)),
    o2B1S1: parseFloat(o2.toFixed(3)), baroPress: 101, ambientTemp: 23, runTime: s.runTime,
  };
  return { state: s, data };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function OBD2Provider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [connectionMode, setConnectionModeState] = useState<ConnectionMode>("DEMO");
  const [liveData, setLiveData] = useState<LiveData>(EMPTY_LIVE_DATA);
  const [dtcList, setDtcList] = useState<DTCEntry[]>([]);
  const [pendingDTCCount, setPendingDTCCount] = useState(0);
  const [moduleDTCs, setModuleDTCs] = useState<ModuleDTCResult[]>([]);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [vehicleSpecs, setVehicleSpecs] = useState<VehicleSpecs | null>(null);
  const [isDecodingVIN, setIsDecodingVIN] = useState(false);
  const [freezeFrame, setFreezeFrame] = useState<FreezeFrameData | null>(null);
  const [readinessMonitors, setReadinessMonitors] = useState<ReadinessMonitor[]>([]);
  const [misfireCounters, setMisfireCounters] = useState<MisfireData[]>([]);
  const [wifiHost, setWifiHostState] = useState("192.168.0.10");
  const [wifiPort, setWifiPortState] = useState(35000);
  const [btDeviceAddress, setBTDeviceAddressState] = useState("");
  const [btDeviceName, setBTDeviceNameState] = useState("");
  const [pairedDevices, setPairedDevices] = useState<BTDevice[]>([]);
  const [isScanningBT, setIsScanningBT] = useState(false);
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isModuleScanning, setIsModuleScanning] = useState(false);
  const [dtcFreezeFrames, setDtcFreezeFrames] = useState<Record<string, FreezeFrameData>>({});
  const [fetchingFreezeFrames, setFetchingFreezeFrames] = useState<Record<string, boolean>>({});
  const cylinderCount = 4;
  const btAvailable = isBluetoothClassicAvailable();

  const demoStateRef = useRef<DemoState>(createDemoState());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const btTransportRef = useRef<BluetoothTransport | null>(null);
  const btPollActiveRef = useRef(false);

  // ── Persist settings ────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("obd2_wifi_host").then((v) => v && setWifiHostState(v));
    AsyncStorage.getItem("obd2_wifi_port").then((v) => v && setWifiPortState(parseInt(v, 10)));
    AsyncStorage.getItem("obd2_bt_address").then((v) => v && setBTDeviceAddressState(v));
    AsyncStorage.getItem("obd2_bt_name").then((v) => v && setBTDeviceNameState(v));
    AsyncStorage.getItem("obd2_conn_mode").then((v) => {
      if (v === "DEMO" || v === "WIFI" || v === "BT") setConnectionModeState(v);
    });
    AsyncStorage.getItem("obd2_vehicle_specs").then((v) => {
      if (v) { try { setVehicleSpecs(JSON.parse(v)); } catch {} }
    });
  }, []);

  // ── Setters ─────────────────────────────────────────────────────────────────
  const setConnectionMode = useCallback((mode: ConnectionMode) => {
    setConnectionModeState(mode); AsyncStorage.setItem("obd2_conn_mode", mode);
  }, []);
  const setWifiHost = useCallback((h: string) => {
    setWifiHostState(h); AsyncStorage.setItem("obd2_wifi_host", h);
  }, []);
  const setWifiPort = useCallback((p: number) => {
    setWifiPortState(p); AsyncStorage.setItem("obd2_wifi_port", p.toString());
  }, []);
  const setBTDevice = useCallback((address: string, name: string) => {
    setBTDeviceAddressState(address);
    setBTDeviceNameState(name);
    AsyncStorage.setItem("obd2_bt_address", address);
    AsyncStorage.setItem("obd2_bt_name", name);
  }, []);

  // ── BT device scan ──────────────────────────────────────────────────────────
  const scanPairedDevices = useCallback(async () => {
    setIsScanningBT(true);
    try {
      const devices = await BluetoothTransport.getBondedDevices();
      setPairedDevices(devices);
    } catch (e: any) {
      setPairedDevices([]);
    } finally {
      setIsScanningBT(false);
    }
  }, []);

  // ── Demo polling ─────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const startDemoPolling = useCallback(() => {
    demoStateRef.current = createDemoState();
    pollingRef.current = setInterval(() => {
      const { state, data } = tickDemo(demoStateRef.current);
      demoStateRef.current = state;
      setLiveData(data);
    }, 500);
  }, []);

  // ── BT polling loop ─────────────────────────────────────────────────────────
  // Polls PIDs sequentially over BT — ELM327 is request/response, not streaming.
  const startBTPolling = useCallback(async () => {
    const transport = btTransportRef.current;
    if (!transport) return;

    btPollActiveRef.current = true;

    const pollCycle = async () => {
      while (btPollActiveRef.current && transport.isConnected()) {
        for (const pid of LIVE_PIDS) {
          if (!btPollActiveRef.current || !transport.isConnected()) break;
          try {
            const raw = await transport.send(pid.cmd, 2500);
            const value = parseResponse(raw, pid);
            if (value !== null) {
              setLiveData((prev) => ({ ...prev, [pid.name]: value }));
            }
          } catch {
            // PID not supported or timeout — skip and continue
          }
        }
        // Brief pause between full cycles to avoid overwhelming the adapter
        await new Promise((r) => setTimeout(r, 100));
      }
      // If we exited the loop due to disconnection, update status
      if (btPollActiveRef.current) {
        btPollActiveRef.current = false;
        setConnectionStatus("ERROR");
        setLiveData(EMPTY_LIVE_DATA);
      }
    };

    pollCycle().catch(() => {
      setConnectionStatus("ERROR");
      setLiveData(EMPTY_LIVE_DATA);
    });
  }, []);

  // ── Connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setConnectionStatus("CONNECTING");

    if (connectionMode === "DEMO") {
      await new Promise((r) => setTimeout(r, 1200));
      setConnectionStatus("CONNECTED");
      startDemoPolling();
      return;
    }

    if (connectionMode === "BT") {
      if (!btAvailable) {
        setConnectionStatus("ERROR");
        return;
      }
      if (!btDeviceAddress) {
        setConnectionStatus("ERROR");
        return;
      }

      try {
        // Check BT is enabled
        const enabled = await BluetoothTransport.isEnabled();
        if (!enabled) {
          const granted = await BluetoothTransport.requestEnable();
          if (!granted) { setConnectionStatus("ERROR"); return; }
        }

        const transport = new BluetoothTransport();
        await transport.connect(btDeviceAddress);
        btTransportRef.current = transport;

        // Run ELM327 initialization sequence
        for (const { cmd, delayMs } of ELM327_INIT_COMMANDS) {
          await transport.send(cmd, 5000);
          await new Promise((r) => setTimeout(r, delayMs));
        }

        // Read battery voltage as a quick sanity check
        const voltage = await transport.send("ATRV", 2000);

        setConnectionStatus("CONNECTED");
        startBTPolling();
      } catch (e: any) {
        btTransportRef.current = null;
        setConnectionStatus("ERROR");
      }
      return;
    }

    // WIFI — placeholder (real TCP socket needs a native module too)
    await new Promise((r) => setTimeout(r, 3000));
    setConnectionStatus("ERROR");
  }, [connectionMode, btDeviceAddress, btAvailable, startDemoPolling, startBTPolling]);

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    stopPolling();
    btPollActiveRef.current = false;
    btTransportRef.current?.disconnect().catch(() => {});
    btTransportRef.current = null;
    setConnectionStatus("DISCONNECTED");
    setLiveData(EMPTY_LIVE_DATA);
    setDtcList([]); setModuleDTCs([]); setVehicleInfo(null);
    setFreezeFrame(null); setTestResult(null); setActiveTest(null);
    setReadinessMonitors([]); setMisfireCounters([]);
  }, [stopPolling]);

  // ── VIN / vehicle info ──────────────────────────────────────────────────────
  const decodeVin = useCallback(async (vin: string) => {
    setIsDecodingVIN(true);
    const specs = await decodeVIN(vin);
    setVehicleSpecs(specs);
    AsyncStorage.setItem("obd2_vehicle_specs", JSON.stringify(specs));
    setIsDecodingVIN(false);
  }, []);

  const clearVehicleSpecs = useCallback(() => {
    setVehicleSpecs(null);
    AsyncStorage.removeItem("obd2_vehicle_specs");
  }, []);

  // ── DTC functions ────────────────────────────────────────────────────────────
  const refreshDTCs = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;
    setIsScanning(true);

    if (connectionMode === "BT" && btTransportRef.current) {
      try {
        const raw = await btTransportRef.current.send("03", 5000);
        const codes = parseDTCResponse(raw);
        const entries = codes.map((c) => lookupDTC(c));
        setDtcList(entries);
        setPendingDTCCount(entries.length);
      } catch {
        // keep existing list
      }
    } else if (connectionMode === "DEMO") {
      await new Promise((r) => setTimeout(r, 1800));
      const entries = ["P0420", "P0171"].map((c) => lookupDTC(c));
      setDtcList(entries); setPendingDTCCount(entries.length);
    } else {
      await new Promise((r) => setTimeout(r, 1800));
    }

    setIsScanning(false);
  }, [connectionStatus, connectionMode]);

  const clearDTCs = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;
    setIsScanning(true);

    if (connectionMode === "BT" && btTransportRef.current) {
      try {
        await btTransportRef.current.send("04", 5000);
      } catch {}
    } else {
      await new Promise((r) => setTimeout(r, 1500));
    }

    setDtcList([]); setModuleDTCs([]); setPendingDTCCount(0); setFreezeFrame(null);
    setIsScanning(false);
  }, [connectionStatus, connectionMode]);

  const scanAllModules = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;
    setIsModuleScanning(true);
    const results: ModuleDTCResult[] = VEHICLE_MODULES.map((m) => ({
      module: m, dtcs: [], scanned: false, scanning: false,
    }));
    setModuleDTCs([...results]);
    for (let i = 0; i < VEHICLE_MODULES.length; i++) {
      results[i] = { ...results[i], scanning: true };
      setModuleDTCs([...results]);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
      const mod = VEHICLE_MODULES[i];
      const dtcs = connectionMode === "DEMO" && mod.demoCodes ? mod.demoCodes.map((c) => lookupDTC(c)) : [];
      results[i] = { ...results[i], dtcs, scanned: true, scanning: false };
      setModuleDTCs([...results]);
    }
    setIsModuleScanning(false);
  }, [connectionStatus, connectionMode]);

  const clearModuleDTCs = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;
    setIsScanning(true);
    await new Promise((r) => setTimeout(r, 1500));
    setModuleDTCs([]); setDtcList([]); setPendingDTCCount(0);
    setIsScanning(false);
  }, [connectionStatus]);

  // ── Vehicle info ─────────────────────────────────────────────────────────────
  const refreshVehicleInfo = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;

    if (connectionMode === "BT" && btTransportRef.current) {
      try {
        // Read protocol description
        const protocol = await btTransportRef.current.send("ATDP", 2000);
        // Read VIN via Mode 09
        const vinRaw = await btTransportRef.current.send("0902", 8000);
        const vin = parseVINResponse(vinRaw) ?? "UNKNOWN";
        // Read battery voltage
        const voltage = await btTransportRef.current.send("ATRV", 2000);
        setVehicleInfo({
          vin,
          protocol: protocol.replace(/\r/g, "").trim() || "Auto",
          ecuName: "ECM - ENGINE CONTROL MODULE",
          calibrationId: "N/A",
          cvn: "N/A",
          fuelType: "Gasoline",
          obd2Support: "OBD-II",
        });
        if (vin !== "UNKNOWN") decodeVin(vin);
      } catch {}
    } else {
      await new Promise((r) => setTimeout(r, 1000));
      if (connectionMode === "DEMO") {
        const vin = "1HGBH41JXMN109186";
        setVehicleInfo({
          vin,
          protocol: "ISO 15765-4 CAN (11-bit ID, 500 Kbaud)",
          ecuName: "ECM - ENGINE CONTROL MODULE",
          calibrationId: "37805-RBB-A560",
          cvn: "F8240A2B",
          fuelType: "Gasoline",
          obd2Support: "OBD-II / EOBD",
        });
        decodeVin(vin);
      }
    }
  }, [connectionStatus, connectionMode, decodeVin]);

  const refreshFreezeFrame = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;
    await new Promise((r) => setTimeout(r, 1200));
    if (connectionMode === "DEMO") {
      setFreezeFrame({
        dtc: "P0420",
        data: { rpm: 1850, speed: 72, coolantTemp: 89, throttle: 22.5, engineLoad: 41.2, fuelLevel: 74.1, batteryVoltage: 13.9, stftB1: 1.6, ltftB1: 3.1 },
        timestamp: new Date(),
      });
    }
  }, [connectionStatus, connectionMode]);

  const refreshReadiness = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;
    if (connectionMode === "BT" && btTransportRef.current) {
      try {
        const raw = await btTransportRef.current.send("0101", 3000);
        const parsed = parsePID01Response(raw);
        if (parsed) { setReadinessMonitors(parsed); return; }
      } catch { /* fall through to demo */ }
    }
    await new Promise((r) => setTimeout(r, 1000));
    if (connectionMode === "DEMO") setReadinessMonitors(getDemoReadiness());
  }, [connectionStatus, connectionMode]);

  const refreshMisfires = useCallback(async () => {
    if (connectionStatus !== "CONNECTED") return;
    await new Promise((r) => setTimeout(r, 800));
    if (connectionMode === "DEMO") {
      setMisfireCounters([
        { cylinder: 1, count: 0, rpm: 800 }, { cylinder: 2, count: 0, rpm: 800 },
        { cylinder: 3, count: 2, rpm: 1850 }, { cylinder: 4, count: 0, rpm: 800 },
      ]);
    }
  }, [connectionStatus, connectionMode]);

  // ── Actuator test & service reset ────────────────────────────────────────────
  const runActuatorTest = useCallback(async (commandId: string, _command: string) => {
    if (connectionStatus !== "CONNECTED") return;
    setActiveTest(commandId); setTestResult(null);
    await new Promise((r) => setTimeout(r, 2000));
    setTestResult(connectionMode === "DEMO" ? "OK - Test completed successfully" : "NO RESPONSE");
    await new Promise((r) => setTimeout(r, 3000));
    setActiveTest(null); setTestResult(null);
  }, [connectionStatus, connectionMode]);

  const runServiceReset = useCallback(async (_resetId: string): Promise<{ success: boolean; message: string }> => {
    if (connectionStatus !== "CONNECTED") return { success: false, message: "Not connected" };
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    if (connectionMode === "DEMO") return { success: true, message: "Reset completed successfully" };
    return { success: false, message: "No response from module" };
  }, [connectionStatus, connectionMode]);

  // ── Per-DTC freeze frame (Mode 02) ──────────────────────────────────────────
  const fetchFreezeFrame = useCallback(async (dtcCode: string) => {
    if (connectionStatus !== "CONNECTED") return;
    setFetchingFreezeFrames((prev) => ({ ...prev, [dtcCode]: true }));

    try {
      if (connectionMode === "BT" && btTransportRef.current) {
        const data: Partial<LiveData> = {};
        for (const pid of FREEZE_FRAME_PIDS) {
          if (!btTransportRef.current.isConnected()) break;
          try {
            const raw = await btTransportRef.current.send(pid.cmd, 2000);
            const value = parseResponse(raw, pid);
            if (value !== null) (data as Record<string, number>)[pid.name] = value;
          } catch { /* PID not supported in freeze frame — skip */ }
        }
        setDtcFreezeFrames((prev) => ({
          ...prev,
          [dtcCode]: { dtc: dtcCode, data, timestamp: new Date() },
        }));
      } else if (connectionMode === "DEMO") {
        await new Promise((r) => setTimeout(r, 1400));
        // Simulate realistic freeze frame values for demo
        setDtcFreezeFrames((prev) => ({
          ...prev,
          [dtcCode]: {
            dtc: dtcCode,
            data: {
              rpm: 1850, speed: 72, coolantTemp: 89,
              throttle: 22.5, engineLoad: 41.2, fuelLevel: 74.1,
              batteryVoltage: 13.9, intakeTemp: 35, oilTemp: 98,
              map: 95, maf: 8.24, timingAdvance: 12.5,
              stftB1: 1.6, ltftB1: 3.1, o2B1S1: 0.72,
              baroPress: 101, ambientTemp: 23, runTime: 842,
            },
            timestamp: new Date(),
          },
        }));
      }
    } finally {
      setFetchingFreezeFrames((prev) => ({ ...prev, [dtcCode]: false }));
    }
  }, [connectionStatus, connectionMode]);

  useEffect(() => { return () => { stopPolling(); btPollActiveRef.current = false; btTransportRef.current?.disconnect().catch(() => {}); }; }, [stopPolling]);

  const value: OBD2ContextValue = {
    connectionStatus, connectionMode, liveData, dtcList, pendingDTCCount,
    moduleDTCs, vehicleInfo, vehicleSpecs, isDecodingVIN, freezeFrame,
    dtcFreezeFrames, fetchingFreezeFrames,
    readinessMonitors, misfireCounters, wifiHost, wifiPort,
    btDeviceAddress, btDeviceName, pairedDevices, isScanningBT, btAvailable,
    activeTest, testResult, isScanning, isModuleScanning, cylinderCount,
    setConnectionMode, setWifiHost, setWifiPort, setBTDevice, scanPairedDevices,
    connect, disconnect, refreshDTCs, clearDTCs, scanAllModules, clearModuleDTCs,
    refreshFreezeFrame, fetchFreezeFrame, refreshVehicleInfo, refreshReadiness,
    refreshMisfires, decodeVin, clearVehicleSpecs, runActuatorTest, runServiceReset,
  };

  return <OBD2Context.Provider value={value}>{children}</OBD2Context.Provider>;
}

export function useOBD2() {
  const ctx = useContext(OBD2Context);
  if (!ctx) throw new Error("useOBD2 must be used within OBD2Provider");
  return ctx;
}
