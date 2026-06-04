export interface VehicleSpecs {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  series: string;
  bodyClass: string;
  vehicleType: string;
  doors: string;
  driveType: string;
  engineCylinders: string;
  engineDisplacementL: string;
  engineDisplacementCC: string;
  engineHP: string;
  engineConfiguration: string;
  fuelType: string;
  fuelInjectionType: string;
  turbo: string;
  transmissionStyle: string;
  transmissionSpeeds: string;
  plantCountry: string;
  plantState: string;
  manufacturerName: string;
  gvwr: string;
  abs: string;
  esc: string;
  airBags: string;
  otherEngineInfo: string;
  error: string | null;
}

const NHTSA_API = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevin";

function pick(results: any[], varName: string): string {
  const found = results.find((r: any) => r.Variable === varName);
  const val = found?.Value ?? "";
  if (!val || val === "Not Applicable" || val === "null" || val === "0") return "";
  return val.trim();
}

export async function decodeVIN(vin: string): Promise<VehicleSpecs> {
  const cleanVin = vin.replace(/\s/g, "").toUpperCase();

  if (cleanVin.length !== 17) {
    return makeErrorSpec(cleanVin, "VIN must be exactly 17 characters");
  }

  try {
    const resp = await fetch(`${NHTSA_API}/${cleanVin}?format=json`, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      return makeErrorSpec(cleanVin, `HTTP ${resp.status}`);
    }

    const json = await resp.json();
    const r = json.Results as any[];

    const errorCode = pick(r, "Error Code");
    if (errorCode && errorCode !== "0") {
      const errorText = pick(r, "Error Text");
      return makeErrorSpec(cleanVin, errorText || `Decode error code ${errorCode}`);
    }

    return {
      vin: cleanVin,
      year: pick(r, "Model Year"),
      make: pick(r, "Make"),
      model: pick(r, "Model"),
      trim: pick(r, "Trim"),
      series: pick(r, "Series"),
      bodyClass: pick(r, "Body Class"),
      vehicleType: pick(r, "Vehicle Type"),
      doors: pick(r, "Number of Doors"),
      driveType: pick(r, "Drive Type"),
      engineCylinders: pick(r, "Engine Number of Cylinders"),
      engineDisplacementL: pick(r, "Displacement (L)"),
      engineDisplacementCC: pick(r, "Displacement (CC)"),
      engineHP: pick(r, "Engine Brake (hp) From"),
      engineConfiguration: pick(r, "Engine Configuration"),
      fuelType: pick(r, "Fuel Type - Primary"),
      fuelInjectionType: pick(r, "Fuel Injection Type"),
      turbo: pick(r, "Turbo"),
      transmissionStyle: pick(r, "Transmission Style"),
      transmissionSpeeds: pick(r, "Transmission Speeds"),
      plantCountry: pick(r, "Plant Country"),
      plantState: pick(r, "Plant State"),
      manufacturerName: pick(r, "Manufacturer Name"),
      gvwr: pick(r, "Gross Vehicle Weight Rating From"),
      abs: pick(r, "Anti-Lock Braking System (ABS)"),
      esc: pick(r, "Electronic Stability Control (ESC)"),
      airBags: pick(r, "Air Bag Locations Front"),
      otherEngineInfo: pick(r, "Other Engine Info"),
      error: null,
    };
  } catch (e: any) {
    return makeErrorSpec(cleanVin, e?.message ?? "Network error");
  }
}

function makeErrorSpec(vin: string, error: string): VehicleSpecs {
  return {
    vin, year: "", make: "", model: "", trim: "", series: "", bodyClass: "",
    vehicleType: "", doors: "", driveType: "", engineCylinders: "", engineDisplacementL: "",
    engineDisplacementCC: "", engineHP: "", engineConfiguration: "", fuelType: "",
    fuelInjectionType: "", turbo: "", transmissionStyle: "", transmissionSpeeds: "",
    plantCountry: "", plantState: "", manufacturerName: "", gvwr: "", abs: "", esc: "",
    airBags: "", otherEngineInfo: "", error,
  };
}

export function buildEngineLabel(specs: VehicleSpecs): string {
  const parts: string[] = [];
  if (specs.engineDisplacementL) parts.push(`${parseFloat(specs.engineDisplacementL).toFixed(1)}L`);
  if (specs.engineConfiguration && specs.engineCylinders) {
    parts.push(`${specs.engineConfiguration}-${specs.engineCylinders}`);
  } else if (specs.engineCylinders) {
    parts.push(`${specs.engineCylinders}-cyl`);
  }
  if (specs.engineHP) parts.push(`${specs.engineHP} hp`);
  if (specs.turbo && specs.turbo.toLowerCase().includes("yes")) parts.push("Turbo");
  return parts.join(" · ");
}
