import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rideInput = z.object({
  origin: z.string().trim().min(1).max(160),
  destination: z.string().trim().min(1).max(160),
  originLat: z.number().finite().min(-90).max(90).optional(),
  originLng: z.number().finite().min(-180).max(180).optional(),
  destinationLat: z.number().finite().min(-90).max(90).optional(),
  destinationLng: z.number().finite().min(-180).max(180).optional(),
  rideDate: z.string().date(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  passengerCount: z.number().int().min(1).max(6).optional(),
  availableSeats: z.number().int().min(1).max(6).optional(),
  timeToleranceMinutes: z
    .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
    .optional(),
  totalPrice: z.number().finite().min(0).max(1000).optional(),
  passengerGenderPreference: z.enum(["ANY", "FEMININO", "MASCULINO"]).optional(),
  price: z.number().finite().min(0).max(1000).optional(),
});

export const createRideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: requestId, error } = await context.supabase.rpc("create_ride_request", {
      p_origin: data.origin,
      p_destination: data.destination,
      p_origin_lat: data.originLat ?? undefined,
      p_origin_lng: data.originLng ?? undefined,
      p_destination_lat: data.destinationLat ?? undefined,
      p_destination_lng: data.destinationLng ?? undefined,
      p_ride_date: data.rideDate,
      p_departure_time: data.departureTime,
      p_passenger_count: data.passengerCount ?? 1,
      p_time_tolerance_minutes: data.timeToleranceMinutes ?? 15,
      p_price: data.price ?? undefined,
    });
    if (error) {
      throw new Error(`Não foi possível criar a solicitação: ${error.message}`);
    }
    return { requestId };
  });

export const createRideOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: offerId, error } = await (context.supabase as any).rpc("create_ride_offer", {
      p_origin: data.origin,
      p_destination: data.destination,
      p_origin_lat: data.originLat ?? undefined,
      p_origin_lng: data.originLng ?? undefined,
      p_destination_lat: data.destinationLat ?? undefined,
      p_destination_lng: data.destinationLng ?? undefined,
      p_ride_date: data.rideDate,
      p_departure_time: data.departureTime,
      p_available_seats: data.availableSeats ?? 1,
      p_time_tolerance_minutes: data.timeToleranceMinutes ?? 15,
      p_total_price: data.totalPrice ?? 30,
      p_passenger_gender_preference: data.passengerGenderPreference ?? "ANY",
    });
    if (error) {
      throw new Error(`Não foi possível criar a oferta: ${error.message}`);
    }
    return { offerId };
  });

const updateRideTotalCostInput = z.object({
  rideId: z.string().uuid(),
  totalPrice: z.number().finite().min(0).max(10000),
});

export const updateRideTotalCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateRideTotalCostInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("update_ride_total_cost", {
      p_ride_id: data.rideId,
      p_total_price: data.totalPrice,
    });
    if (error) {
      throw new Error(`Não foi possível atualizar o valor da carona: ${error.message}`);
    }
    return { totalPrice: Number(result) };
  });
