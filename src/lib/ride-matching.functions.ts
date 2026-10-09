import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { travelPreferencesSchema } from "./travel-preferences";

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
  preferences: travelPreferencesSchema.optional(),
  idempotencyKey: z.string().uuid(),
  vehicleDescription: z.string().trim().max(160).optional(),
  meetingPoint: z.string().trim().max(200).optional(),
  meetingLat: z.number().finite().min(-90).max(90).optional(),
  meetingLng: z.number().finite().min(-180).max(180).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((data, context) => {
  if ((data.meetingLat == null) !== (data.meetingLng == null)) {
    context.addIssue({ code: "custom", message: "Informe as duas coordenadas do ponto de encontro." });
  }
});

export const createRideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: requestId, error } = await context.supabase.rpc("create_preferred_ride", {
      p_kind: "request", p_details: data, p_preferences: data.preferences,
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
    if (!data.vehicleDescription?.trim() || !data.meetingPoint?.trim()) {
      throw new Error("Informe o veículo e o ponto de encontro antes de publicar a oferta.");
    }
    const { data: offerId, error } = await context.supabase.rpc("create_preferred_ride", {
      p_kind: "offer", p_details: data, p_preferences: data.preferences,
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
