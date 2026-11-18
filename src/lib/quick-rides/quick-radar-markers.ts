import type { ApproximateProfessionalDriver } from "@/components/caronaa/HomeRideMap";

type VehicleType = "CAR" | "MOTO";

/** Discovery radius around the passenger pickup (server clamps to 1–30 km). */
export const QUICK_RADAR_RADIUS_KM = 15;

/**
 * Render only authorized, approximate positions returned by the existing
 * discover_caronaa_quick_drivers RPC. Do NOT geocode, interpolate or synthesize
 * driver locations here; the server owns approval, region, vehicle and GPS TTL.
 */
export function mapQuickRadarDrivers(
  rows: unknown,
  selectedVehicle: VehicleType,
): ApproximateProfessionalDriver[] {
  if (!Array.isArray(rows)) return [];

  const seen = new Set<string>();
  const mapped: ApproximateProfessionalDriver[] = [];
  for (const value of rows) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    // Compatible with newer RPCs that provide explicit self/diagnostic flags.
    if (entry.is_self === true || entry.simulated === true) continue;

    const key = entry.driver_key;
    const lat = entry.lat;
    const lng = entry.lng;
    const sampledAt = entry.seen_at;
    // Backend exposes a daily pseudonymous MD5 key and 0.001-degree
    // coordinates (~100m); never infer or disclose an exact unassigned position.
    if (typeof key !== "string" || !/^[a-f0-9]{32}$/i.test(key) || seen.has(key)) continue;
    if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) continue;
    if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) continue;
    if (typeof sampledAt !== "string" || !Number.isFinite(Date.parse(sampledAt))) continue;
    const age = Date.now() - Date.parse(sampledAt);
    if (age > 90_000 || age < -5_000) continue;
    seen.add(key);
    mapped.push({
      driver_key: key,
      lat,
      lng,
      seen_at: sampledAt,
      is_self: false,
      vehicle_type: selectedVehicle,
    });
  }
  return mapped;
}
