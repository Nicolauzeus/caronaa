/**
 * CARONAA — unified fare policy.
 *
 * Independent calculation module. Existing quote/payment RPCs are NOT rewired
 * until the unified configuration is deployed, verified and approved.
 * Values are BRL; money is rounded once at the points stated in the policy.
 */
import { supabase } from "@/integrations/supabase/client";
import { roundMoney } from "@/lib/ride-cost";

export type UnifiedFareMode = "ON_ROUTE" | "EXCLUSIVE";
export type UnifiedVehicleType = "CAR" | "MOTO";

export type UnifiedPricingConfig = Readonly<{
  on_route_rate_per_km: number;
  minimum_fare: number;
  exclusive_multiplier: number;
}>;

export type UnifiedFareInput = Readonly<{
  distanceKm: number;
  mode: UnifiedFareMode;
  vehicleType: UnifiedVehicleType;
  /** Number of seats booked in ON_ROUTE. EXCLUSIVE ignores booked seats. */
  seats?: number;
}>;

export type UnifiedFareResult = Readonly<{
  mode: UnifiedFareMode;
  vehicleType: UnifiedVehicleType;
  seats: number;
  distanceKm: number;
  perSeatFare: number | null;
  totalFare: number;
  totalFareCents: number;
  configSource: "DATABASE" | "FALLBACK";
}>;

export const DEFAULT_UNIFIED_PRICING_CONFIG: UnifiedPricingConfig = Object.freeze({
  on_route_rate_per_km: 6 / 11,
  minimum_fare: 3,
  exclusive_multiplier: 1.30,
});

export function isValidUnifiedPricingConfig(value: unknown): value is UnifiedPricingConfig {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return [obj.on_route_rate_per_km, obj.minimum_fare, obj.exclusive_multiplier].every(
    (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
  );
}

/**
 * Only known policy fields are consumed. Do not infer a configuration from
 * prices sent by the browser. A failed/empty/malformed query uses defaults.
 */
export async function loadUnifiedPricingConfig(): Promise<{
  config: UnifiedPricingConfig;
  source: "DATABASE" | "FALLBACK";
}> {
  try {
    const { data, error } = await (supabase as any)
      .from("caronaa_unified_pricing_configs")
      .select("on_route_rate_per_km,minimum_fare,exclusive_multiplier")
      .limit(1)
      .maybeSingle();
    if (error || !data) throw new Error("UNIFIED_PRICING_CONFIG_UNAVAILABLE");
    const config = {
      on_route_rate_per_km: Number(data.on_route_rate_per_km),
      minimum_fare: Number(data.minimum_fare),
      exclusive_multiplier: Number(data.exclusive_multiplier),
    };
    if (!isValidUnifiedPricingConfig(config)) throw new Error("UNIFIED_PRICING_CONFIG_INVALID");
    return { config, source: "DATABASE" };
  } catch {
    return { config: DEFAULT_UNIFIED_PRICING_CONFIG, source: "FALLBACK" };
  }
}

/**
 * Strict policy:
 * ON_ROUTE: max(roundMoney(distance * rate), minimum) per seat, times seats.
 * EXCLUSIVE: max(distance * rate * vehicleBaseSeats, minimum) * multiplier,
 *            rounded only after multiplication.
 */
export function calculateUnifiedFare(
  input: UnifiedFareInput,
  config: UnifiedPricingConfig = DEFAULT_UNIFIED_PRICING_CONFIG,
  configSource: "DATABASE" | "FALLBACK" = "FALLBACK",
): UnifiedFareResult {
  const { distanceKm, mode, vehicleType } = input;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0)
    throw new Error("A distância deve ser um número positivo e finito.");
  if (mode !== "ON_ROUTE" && mode !== "EXCLUSIVE")
    throw new Error("Modalidade de tarifa inválida.");
  if (vehicleType !== "CAR" && vehicleType !== "MOTO")
    throw new Error("Tipo de veículo inválido.");
  if (!isValidUnifiedPricingConfig(config))
    throw new Error("Configuração de tarifa inválida.");

  if (mode === "ON_ROUTE") {
    const seats = input.seats ?? 1;
    const maxSeats = vehicleType === "MOTO" ? 1 : 3;
    if (!Number.isInteger(seats) || seats < 1 || seats > maxSeats)
      throw new Error("Quantidade de vagas inválida para o veículo.");
    const perSeatFare = Math.max(
      roundMoney(distanceKm * config.on_route_rate_per_km),
      config.minimum_fare,
    );
    // Multiply the rounded per-seat fare by the exact number of reserved seats.
    const totalFare = roundMoney(perSeatFare * seats);
    return {
      mode, vehicleType, seats, distanceKm,
      perSeatFare, totalFare, totalFareCents: Math.round(totalFare * 100),
      configSource,
    };
  }

  const baseSeats = vehicleType === "CAR" ? 3 : 1;
  const totalFare = roundMoney(
    Math.max(distanceKm * config.on_route_rate_per_km * baseSeats, config.minimum_fare) *
    config.exclusive_multiplier,
  );
  return {
    mode, vehicleType, seats: baseSeats, distanceKm,
    perSeatFare: null, totalFare, totalFareCents: Math.round(totalFare * 100),
    configSource,
  };
}

export async function quoteUnifiedFare(input: UnifiedFareInput): Promise<UnifiedFareResult> {
  const { config, source } = await loadUnifiedPricingConfig();
  return calculateUnifiedFare(input, config, source);
}
