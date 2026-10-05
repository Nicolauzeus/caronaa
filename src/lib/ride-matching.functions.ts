import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rideInput = z.object({
  origin: z.string().trim().min(1).max(160),
  destination: z.string().trim().min(1).max(160),
  rideDate: z.string().date(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  passengerCount: z.number().int().min(1).max(6).optional(),
  availableSeats: z.number().int().min(1).max(6).optional(),
});

export const createRideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: requestId, error } = await context.supabase.rpc("create_ride_request", {
      p_origin: data.origin,
      p_destination: data.destination,
      p_ride_date: data.rideDate,
      p_departure_time: data.departureTime,
      p_passenger_count: data.passengerCount ?? 1,
    });
    if (error) throw new Error(`Não foi possível criar a solicitação: ${error.message}`);
    return { requestId };
  });

export const createRideOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: offerId, error } = await context.supabase.rpc("create_ride_offer", {
      p_origin: data.origin,
      p_destination: data.destination,
      p_ride_date: data.rideDate,
      p_departure_time: data.departureTime,
      p_available_seats: data.availableSeats ?? 1,
    });
    if (error) throw new Error(`Não foi possível criar a oferta: ${error.message}`);
    return { offerId };
  });
