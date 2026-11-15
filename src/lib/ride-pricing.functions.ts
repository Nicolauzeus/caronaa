import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePassengerFare, calculateRequestedGroupFare, PASSENGER_TARIFF } from "./ride-cost";
import { calculateFreeSeatPotential } from "./ride-potential";
import { getDrivingDistanceKm } from "./road-routing";

const rideIdInput = z.object({ rideId: z.string().uuid() });
const routeInput = z
  .object({
    origin: z.string().trim().min(1).max(160),
    destination: z.string().trim().min(1).max(160),
    originLat: z.number().finite().min(-90).max(90).optional(),
    originLng: z.number().finite().min(-180).max(180).optional(),
    destinationLat: z.number().finite().min(-90).max(90).optional(),
    destinationLng: z.number().finite().min(-180).max(180).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.originLat == null) !== (data.originLng == null) ||
      (data.destinationLat == null) !== (data.destinationLng == null)
    )
      ctx.addIssue({ code: "custom", message: "Informe as duas coordenadas do local." });
  });
const remainingPotentialInput = z.object({
  offerId: z.string().uuid(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
type AdminQuery = {
  select(columns: string): AdminQuery;
  eq(column: string, value: unknown): AdminQuery;
  maybeSingle(): Promise<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
};

/** Persists an authenticated, server-calculated passenger route quote before
 * the request is sent. The allocator copies this exact quote to the proposal.
 */
export const previewRequestFare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => routeInput.parse(input))
  .handler(async ({ context, data }) => {
    const { googleActionFetch } = await import("./google-request.server");
    const googleRequest = googleActionFetch(context.userId, "quote", "previewRequestFare");
    const { geocodeAddressService } = await import("./location/service");
    const [origin, destination] = await Promise.all([
      data.originLat != null && data.originLng != null
        ? Promise.resolve({ lat: data.originLat, lng: data.originLng, isApproximate: false })
        : geocodeAddressService(data.origin, googleRequest),
      data.destinationLat != null && data.destinationLng != null
        ? Promise.resolve({
            lat: data.destinationLat,
            lng: data.destinationLng,
            isApproximate: false,
          })
        : geocodeAddressService(data.destination, googleRequest),
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
        googleRequest,
      );
    } catch {
      throw new Error("Não foi possível estimar o preço agora. Tente novamente.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => {
          select: (columns: string) => {
            single: () => Promise<{
              data: { quote_id: string; expires_at: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    const { data: quote, error } = await admin
      .from("offer_route_quotes")
      .insert({
        user_id: context.userId,
        origin: data.origin,
        destination: data.destination,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        distance_km: distanceKm,
        passenger_price: calculatePassengerFare(distanceKm),
        tariff_reference: PASSENGER_TARIFF.reference,
      })
      .select("quote_id, expires_at")
      .single();
    if (error || !quote)
      throw new Error("Não foi possível salvar a cotação do trecho. Tente novamente.");

    return {
      originPoint: { lat: origin.lat, lng: origin.lng },
      destinationPoint: { lat: destination.lat, lng: destination.lng },
      quoteId: quote.quote_id,
      expiresAt: quote.expires_at,
      distanceKm,
      pricePerPassenger: calculatePassengerFare(distanceKm),
      tariffReference: PASSENGER_TARIFF.reference,
    };
  });

/**
 * Recalculates the possible fare for remaining free seats from a driver-authorized
 * current location to the destination. Coordinates are transient inputs: only
 * the authenticated owner may request this calculation and we never persist GPS.
 */
export const calculateOfferRemainingPotential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => remainingPotentialInput.parse(input))
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: unknown,
          ) => {
            maybeSingle: () => Promise<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    const { data: offer, error } = await client
      .from("ride_offers")
      .select("offer_id, user_id, destination_lat, destination_lng, seats_remaining, status")
      .eq("offer_id", data.offerId)
      .maybeSingle();
    if (error || !offer || offer.user_id !== context.userId) {
      throw new Error("Esta publicação não foi encontrada.");
    }
    if (!["available", "full"].includes(String(offer.status))) {
      throw new Error("Esta publicação não está ativa para novas solicitações.");
    }
    const destinationLat = Number(offer.destination_lat);
    const destinationLng = Number(offer.destination_lng);
    const freeSeats = Number(offer.seats_remaining);
    if (!Number.isFinite(destinationLat) || !Number.isFinite(destinationLng)) {
      throw new Error(
        "O destino não tem coordenadas confiáveis para calcular o percurso restante.",
      );
    }
    if (!Number.isInteger(freeSeats) || freeSeats < 0) {
      throw new Error("Não foi possível confirmar quantas vagas estão livres.");
    }
    let distanceKm: number;
    try {
      const { googleActionFetch } = await import("./google-request.server");
      distanceKm = await getDrivingDistanceKm(
        { lat: data.latitude, lng: data.longitude },
        { lat: destinationLat, lng: destinationLng },
        googleActionFetch(context.userId, "quote", "calculateOfferRemainingPotential"),
      );
    } catch {
      throw new Error(
        "Não foi possível recalcular o percurso rodoviário restante. A estimativa anterior foi mantida.",
      );
    }
    const potential = calculateFreeSeatPotential(distanceKm, freeSeats);
    return {
      ...potential,
      calculatedAt: new Date().toISOString(),
      tariffReference: PASSENGER_TARIFF.reference,
    };
  });

export const calculateRideQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideIdInput.parse(input))
  .handler(async ({ context, data }) => {
    const participantClient = context.supabase as unknown as {
      from: (table: string) => AdminQuery;
    };
    const { data: ride, error: rideError } = await participantClient
      .from("rides")
      .select(
        "ride_id, request_id, passenger_user_id, driver_user_id, status, passenger_accepted_at, driver_accepted_at, response_expires_at, route_distance_km, passenger_price, passenger_group_total, tariff_reference",
      )
      .eq("ride_id", data.rideId)
      .maybeSingle();
    if (rideError || !ride) throw new Error("Combinação não encontrada.");
    if (![ride.passenger_user_id, ride.driver_user_id].map(String).includes(context.userId)) {
      throw new Error("Você não pode consultar o preço desta combinação.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => AdminQuery;
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
    if (
      ride.route_distance_km != null &&
      ride.passenger_price != null &&
      ride.passenger_group_total != null
    ) {
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
    if (
      typeof ride.response_expires_at !== "string" ||
      Date.parse(ride.response_expires_at) <= Date.now()
    ) {
      throw new Error("Esta combinação expirou. Procure uma nova combinação.");
    }

    const { data: request, error: requestError } = await admin
      .from("ride_requests")
      .select("user_id, origin, destination, passenger_count")
      .eq("request_id", ride.request_id)
      .maybeSingle();
    if (
      requestError ||
      !request ||
      request.user_id !== ride.passenger_user_id ||
      typeof request.origin !== "string" ||
      typeof request.destination !== "string"
    ) {
      throw new Error("Não foi possível validar o trecho do passageiro.");
    }

    // Re-geocode server-side; browser coordinates and prices are never trusted.
    const { googleActionFetch } = await import("./google-request.server");
    const googleRequest = googleActionFetch(context.userId, "quote", "calculateRideQuote");
    const { geocodeAddressService } = await import("./location/service");
    const [origin, destination] = await Promise.all([
      geocodeAddressService(request.origin, googleRequest),
      geocodeAddressService(request.destination, googleRequest),
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
      throw new Error(
        "Não foi possível localizar com precisão o trecho. Revise os endereços e tente novamente.",
      );
    }

    let distanceKm: number;
    try {
      distanceKm = await getDrivingDistanceKm(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
        googleRequest,
      );
    } catch {
      throw new Error(
        "Não foi possível calcular o preço agora. Confira os endereços e tente novamente.",
      );
    }
    const pricePerPassenger = calculatePassengerFare(distanceKm);
    const groupTotal = calculateRequestedGroupFare(
      pricePerPassenger,
      Number(request.passenger_count),
    );
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
    if (
      !readError &&
      current?.route_distance_km != null &&
      current.passenger_price != null &&
      current.passenger_group_total != null
    ) {
      return {
        distanceKm: Number(current.route_distance_km),
        pricePerPassenger: Number(current.passenger_price),
        groupTotal: Number(current.passenger_group_total),
        tariffReference: String(current.tariff_reference ?? PASSENGER_TARIFF.reference),
      };
    }
    console.error("Ride quote persistence failed", {
      rideId: data.rideId,
      message: persistError?.message ?? readError?.message,
    });
    throw new Error("Não foi possível salvar e confirmar o preço. Tente novamente.");
  });
