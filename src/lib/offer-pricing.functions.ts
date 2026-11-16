import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePassengerFare, PASSENGER_TARIFF } from "./ride-cost";
import { getDrivingRoute } from "./road-routing";

const pointInput = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export const offerRouteInput = z.object({
  origin: z.string().trim().min(1).max(160),
  destination: z.string().trim().min(1).max(160),
  originPoint: pointInput.optional(),
  destinationPoint: pointInput.optional(),
});

export const quoteOfferRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => offerRouteInput.parse(input))
  .handler(async ({ context, data }) => {
    const { googleActionFetch } = await import("./google-request.server");
    const request = googleActionFetch(context.userId, "quote", "quoteOfferRoute");
    const { geocodeAddressService } = await import("./location/service");
    const [origin, destination] = await Promise.all([
      data.originPoint
        ? { ...data.originPoint, isApproximate: false }
        : geocodeAddressService(data.origin, request),
      data.destinationPoint
        ? { ...data.destinationPoint, isApproximate: false }
        : geocodeAddressService(data.destination, request),
    ]);
    if (
      !origin ||
      !destination ||
      origin.isApproximate ||
      destination.isApproximate ||
      typeof origin.lat !== "number" ||
      typeof origin.lng !== "number" ||
      typeof destination.lat !== "number" ||
      typeof destination.lng !== "number"
    ) {
      throw new Error("Revise os endereços para calcular o preço do percurso.");
    }
    let route;
    try {
      route = await getDrivingRoute([
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
      ], request);
    } catch {
      throw new Error("Não foi possível calcular o percurso rodoviário. Tente novamente.");
    }
    const distanceKm = route.distanceKm;
    const pricePerPassenger = calculatePassengerFare(distanceKm);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quoteClient = supabaseAdmin as unknown as {
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
    const { data: quote, error } = await quoteClient
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
        route_path: route.routePath,
        route_duration_minutes: route.durationMinutes,
        passenger_price: pricePerPassenger,
        tariff_reference: PASSENGER_TARIFF.reference,
      })
      .select("quote_id, expires_at")
      .single();
    if (error || !quote || !Number.isFinite(Date.parse(quote.expires_at)))
      throw new Error("Não foi possível salvar o preço. Tente novamente.");
    return {
      quoteId: quote.quote_id,
      expiresAt: quote.expires_at,
      originPoint: { lat: origin.lat, lng: origin.lng },
      destinationPoint: { lat: destination.lat, lng: destination.lng },
      distanceKm,
      durationMinutes: route.durationMinutes,
      pricePerPassenger,
      routePath: route.routePath,
    };
  });
