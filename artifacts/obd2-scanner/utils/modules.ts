export interface VehicleModule {
  id: string;
  name: string;
  shortName: string;
  address: string;
  color: string;
  icon: string;
  demoCodes?: string[];
}

export const VEHICLE_MODULES: VehicleModule[] = [
  {
    id: "ECM",
    name: "Engine Control Module",
    shortName: "ECM",
    address: "7E0",
    color: "#00D4FF",
    icon: "cpu",
    demoCodes: ["P0420", "P0171"],
  },
  {
    id: "TCM",
    name: "Transmission Control Module",
    shortName: "TCM",
    address: "7E1",
    color: "#A78BFA",
    icon: "settings",
    demoCodes: [],
  },
  {
    id: "BCM",
    name: "Body Control Module",
    shortName: "BCM",
    address: "7B0",
    color: "#34D399",
    icon: "zap",
    demoCodes: ["B1352"],
  },
  {
    id: "ABS",
    name: "Anti-lock Braking System",
    shortName: "ABS",
    address: "760",
    color: "#FB923C",
    icon: "disc",
    demoCodes: [],
  },
  {
    id: "SRS",
    name: "Supplemental Restraint System",
    shortName: "SRS/AIR",
    address: "740",
    color: "#FF6B6B",
    icon: "shield",
    demoCodes: [],
  },
  {
    id: "HVAC",
    name: "HVAC Control Module",
    shortName: "HVAC",
    address: "7A0",
    color: "#60A5FA",
    icon: "thermometer",
    demoCodes: [],
  },
  {
    id: "TPMS",
    name: "Tire Pressure Monitor",
    shortName: "TPMS",
    address: "C0",
    color: "#FCD34D",
    icon: "circle",
    demoCodes: [],
  },
  {
    id: "CLUSTER",
    name: "Instrument Panel Cluster",
    shortName: "CLUSTER",
    address: "620",
    color: "#94A3B8",
    icon: "bar-chart-2",
    demoCodes: [],
  },
  {
    id: "ADAS",
    name: "Advanced Driver Assist",
    shortName: "ADAS",
    address: "7D0",
    color: "#F472B6",
    icon: "eye",
    demoCodes: [],
  },
];

export interface MisfireData {
  cylinder: number;
  count: number;
  rpm: number;
}
