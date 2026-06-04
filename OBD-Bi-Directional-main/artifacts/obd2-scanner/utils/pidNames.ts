/** Shared type for the keys that PID definitions map to in LiveData */
export interface PIDDataKeys {
  rpm: number | null;
  speed: number | null;
  coolantTemp: number | null;
  throttle: number | null;
  engineLoad: number | null;
  fuelLevel: number | null;
  batteryVoltage: number | null;
  intakeTemp: number | null;
  oilTemp: number | null;
  map: number | null;
  maf: number | null;
  timingAdvance: number | null;
  stftB1: number | null;
  ltftB1: number | null;
  o2B1S1: number | null;
  baroPress: number | null;
  ambientTemp: number | null;
  runTime: number | null;
}
