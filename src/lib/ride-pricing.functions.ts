import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePassengerFare, PASSENGER_TARIFF } from "./ride-cost";
import { getDrivingDistanceKm } from "./road-routing";

const rideIdInput = z.object({ rideId: z.string().uuid() });
const routeInput = z.object({
  origin: z.string().trim().min(1).max(160),
  destination: z.string().trim().min(1).max(160),
});
type AdminQuery = {
  select(columns: string): AdminQuery;
  eq(column: string, value: unknown): AdminQuery;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};

/** Informational estimate for a passenger before publishing a request. The
 * persisted quote is recalculated server-side after matching and before accept.
 */
export const previewRequestFare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => routeInput.parse(input))
  .handler(async ({ data }) => {
    const { geocodeAddressService } = await import("./location/service");
    const [origin, destination] = await Promise.all([
      geocodeAddressService(data.origin),
      geocodeAddressService(data.destination),
    ]);
    if (
      !origin ||
      !destination ||
      origin.isApproximate === true ||
      destination.isApproximate === true ||
      typeof origin.lat !== "number" ||
      !Number.isFinite(origin.lat) ||
      typeof origin.lng !== "number" ||
      !Number.isFinite(origin.lng) ||
      typeof destination.lat !== "number" ||
      !Number.isFinite(destination.lat) ||
      typeof destination.lng !== "number" ||
      !Number.isFinite(destination.lng)
    ) {
      throw new Error("Revise os endereços para estimar o preço do trecho.");
    }

    let distanceKm: number;
    try {
      distanceKm = await getDrivingDistanceKm(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
      );
    } catch {
      throw new Error("Não foi possível estimar o preço agora. Tente novamente.");
    }

    return {
      distanceKm,
      pricePerPassenger: calculatePassengerFare(distanceKm),
      tariffReference: PASSENGER_TARIFF.reference,
    };
  });

export const calculateRideQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideIdInput.parse(input))
  .handler(async ({ context, data }) => {
    const participantClient = context.supabase as unknown as { from: (table: string) => AdminQuery };
    const { data: ride, error: rideError } = await participantClient
      .from("rides")
      .select("ride_id, request_id, passenger_user_id, driver_user_id, status, passenger_accepted_at, driver_accepted_at, response_expires_at, route_distance_km, passenger_price, passenger_group_total, tariff_reference")
      .eq("ride_id", data.rideId)
      .maybeSingle();
    if (rideError || !ride) throw new Error("Combinação não encontrada.");
    if (![ride.passenger_user_id, ride.driver_user_id].map(String).includes(context.userId)) {
      throw new Error("Você não pode consultar o preço desta combinação.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => AdminQuery;
      rpc: (name: string, args: Record<string, unknown>) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
    if (ride.route_distance_km != null && ride.passenger_price != null && ride.passenger_group_total != null) {
      return {
        distanceKm: Number(ride.route_distance_km),
        pricePerPassenger: Number(ride.passenger_price),
        groupTotal: Number(ride.passenger_group_total),
        tariffReference: String(ride.tariff_reference ?? PASSENGER_TARIFF.reference),
      };
    }
    if (ride.status !== "MATCHED" || ride.passenger_accepted_at || ride.driver_accepted_at) {
      throw new Error("Só é possível calcular o preço de uma proposta pendente de aceite.");
    }
    if (typeof ride.response_expires_at !== "string" || Date.parse(ride.response_expires_at) <= Date.now()) {
      throw new Error("Esta combinação expirou. Procure uma nova combinação.");
    }

    const { data: request, error: requestError } = await admin
      .from("ride_requests")
      .select("user_id, origin, destination, passenger_count")
      .eq("request_id", ride.request_id)
      .maybeSingle();
    if (requestError || !request || request.user_id !== ride.passenger_user_id || typeof request.origin !== "string" || typeof request.destination !== "string") {
      throw new Error("Não foi possível validar o trecho do passageiro.");
    }

    // Re-geocode server-side; browser coordinates and prices are never trusted.
    const { geocodeAddressService } = await import("./location/service");
    const [origin, destination] = await Promise.all([
      geocodeAddressService(request.origin),
      geocodeAddressService(request.destination),
    ]);
    if (!origin || !destination || origin.isApproximate === true || destination.isApproximate === true ||
      typeof origin.lat !== "number" || !Number.isFinite(origin.lat) ||
      typeof origin.lng !== "number" || !Number.isFinite(origin.lng) ||
      typeof destination.lat !== "number" || !Number.isFinite(destination.lat) ||
      typeof destination.lng !== "number" || !Number.isFinite(destination.lng)) {
      throw new Error("Não foi possível localizar com precisão o trecho. Revise os endereços e tente novamente.");
    }

    let distanceKm: number;
    try {
      distanceKm = await getDrivingDistanceKm(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
      );
    } catch {
      throw new Error("Não foi possível calcular o preço agora. Confira os endereços e tente novamente.");
    }
    const pricePerPassenger = calculatePassengerFare(distanceKm);
    const groupTotal = Math.round(pricePerPassenger * Number(request.passenger_count) * 100) / 100;
    const { error: persistError } = await admin.rpc("persist_ride_route_quote", {
      p_ride_id: data.rideId,
      p_route_distance_km: distanceKm,
      p_passenger_price: pricePerPassenger,
      p_group_total: groupTotal,
      p_tariff_reference: PASSENGER_TARIFF.reference,
    });
    // Always return the persisted winner, including when the RPC returns false
    // because another participant saved a quote concurrently.
    const { data: current, error: readError } = await participantClient
        .from("rides")
        .select("route_distance_km, passenger_price, passenger_group_total, tariff_reference")
        .eq("ride_id", data.rideId)
        .maybeSingle();
      if (!readError && current?.route_distance_km != null && current.passenger_price != null && current.passenger_group_total != null) {
        return {
          distanceKm: Number(current.route_distance_km),
          pricePerPassenger: Number(current.passenger_price),
          groupTotal: Number(current.passenger_group_total),
          tariffReference: String(current.tariff_reference ?? PASSENGER_TARIFF.reference),
        };
      }
    console.error("Ride quote persistence failed", { rideId: data.rideId, message: persistError?.message ?? readError?.message });
    throw new Error("Não foi possível salvar e confirmar o preço. Tente novamente.");
  });
