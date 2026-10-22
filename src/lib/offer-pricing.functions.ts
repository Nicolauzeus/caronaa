import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePassengerFare, PASSENGER_TARIFF } from "./ride-cost";
import { getDrivingRoute } from "./road-routing";

export const quoteOfferRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: z.string().trim().min(1).max(160),
        destination: z.string().trim().min(1).max(160),
        originLat: z.number().finite().min(-90).max(90).optional(),
        originLng: z.number().finite().min(-180).max(180).optional(),
        destinationLat: z.number().finite().min(-90).max(90).optional(),
        destinationLng: z.number().finite().min(-180).max(180).optional(),
      })
      .superRefine((value, ctx) => {
        if ((value.originLat == null) !== (value.originLng == null) ||
            (value.destinationLat == null) !== (value.destinationLng == null)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Coordenadas incompletas." });
        }
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { geocodeAddressService } = await import("./location/service");
    // Use the driver's exact chosen coordinates when provided (GPS or autocomplete).
    // Falling back to text geocoding preserves existing callers.
    const [origin, destination] = await Promise.all([
      data.originLat != null && data.originLng != null
        ? Promise.resolve({ lat: data.originLat, lng: data.originLng, isApproximate: false })
        : geocodeAddressService(data.origin),
      data.destinationLat != null && data.destinationLng != null
        ? Promise.resolve({ lat: data.destinationLat, lng: data.destinationLng, isApproximate: false })
        : geocodeAddressService(data.destination),
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
      ]);
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
              data: { quote_id: string } | null;
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
      .select("quote_id")
      .single();
    if (error || !quote) throw new Error("Não foi possível salvar o preço. Tente novamente.");
    return {
      quoteId: quote.quote_id,
      distanceKm,
      durationMinutes: route.durationMinutes,
      pricePerPassenger,
      routePath: route.routePath,
    };
  });
