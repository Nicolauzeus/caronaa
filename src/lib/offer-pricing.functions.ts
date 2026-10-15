import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePassengerFare, PASSENGER_TARIFF } from "./ride-cost";
import { getDrivingDistanceKm } from "./road-routing";

export const quoteOfferRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().trim().min(1).max(160), destination: z.string().trim().min(1).max(160) }).parse(input))
  .handler(async ({ context, data }) => {
    const { geocodeAddressService } = await import("./location/service");
    const [origin, destination] = await Promise.all([geocodeAddressService(data.origin), geocodeAddressService(data.destination)]);
    if (!origin || !destination || origin.isApproximate || destination.isApproximate ||
      typeof origin.lat !== "number" || typeof origin.lng !== "number" || typeof destination.lat !== "number" || typeof destination.lng !== "number") {
      throw new Error("Revise os endereços para calcular o preço do percurso.");
    }
    let distanceKm: number;
    try { distanceKm = await getDrivingDistanceKm({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng }); }
    catch { throw new Error("Não foi possível calcular o preço. Tente novamente."); }
    const pricePerPassenger = calculatePassengerFare(distanceKm);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quote, error } = await supabaseAdmin.from("offer_route_quotes").insert({
      user_id: context.userId, origin: data.origin, destination: data.destination,
      distance_km: distanceKm, passenger_price: pricePerPassenger, tariff_reference: PASSENGER_TARIFF.reference,
    }).select("quote_id").single();
    if (error || !quote) throw new Error("Não foi possível salvar o preço. Tente novamente.");
    return { quoteId: quote.quote_id, distanceKm, pricePerPassenger };
  });