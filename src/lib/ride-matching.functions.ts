import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { travelPreferencesSchema } from "./travel-preferences";

const rideInput = z
  .object({
    origin: z.string().trim().min(1).max(160),
    destination: z.string().trim().min(1).max(160),
    originLat: z.number().finite().min(-90).max(90).optional(),
    originLng: z.number().finite().min(-180).max(180).optional(),
    destinationLat: z.number().finite().min(-90).max(90).optional(),
    destinationLng: z.number().finite().min(-180).max(180).optional(),
    rideDate: z.string().date(),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    passengerCount: z.number().int().min(1).max(6).optional(),
    availableSeats: z.number().int().min(1).max(7).optional(),
    timeToleranceMinutes: z
      .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
      .optional(),
    passengerGenderPreference: z.enum(["ANY", "FEMININO", "MASCULINO"]).optional(),
    preferences: travelPreferencesSchema.optional(),
    idempotencyKey: z.string().uuid(),
    vehicleDescription: z.string().trim().max(160).optional(),
    meetingPoint: z.string().trim().max(200).optional(),
    meetingLat: z.number().finite().min(-90).max(90).optional(),
    meetingLng: z.number().finite().min(-180).max(180).optional(),
    notes: z.string().trim().max(500).optional(),
    quoteId: z.string().uuid().optional(),
  })
  .superRefine((data, context) => {
    if ((data.meetingLat == null) !== (data.meetingLng == null)) {
      context.addIssue({
        code: "custom",
        message: "Informe as duas coordenadas do ponto de encontro.",
      });
    }
  });

const pricedRequestInput = z.object({
  quoteId: z.string().uuid(),
  rideDate: z.string().date(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  passengerCount: z.number().int().min(1).max(6).default(1),
  timeToleranceMinutes: z
    .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
    .default(15),
  preferences: travelPreferencesSchema.optional(),
});

export const createRideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pricedRequestInput.parse(input))
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: requestId, error } = await client.rpc("create_priced_ride_request", {
      p_quote_id: data.quoteId,
      p_ride_date: data.rideDate,
      p_departure_time: data.departureTime,
      p_passenger_count: data.passengerCount,
      p_time_tolerance_minutes: data.timeToleranceMinutes,
      p_preferences: data.preferences,
    });
    if (error) {
      throw new Error(`Não foi possível criar a solicitação: ${error.message}`);
    }
    if (typeof requestId !== "string")
      throw new Error("A solicitação retornou um identificador inválido.");
    return { requestId };
  });
export const createRideOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles").select("vehicle_brand, vehicle_description").eq("id", context.userId).single();
    if (profileError) throw new Error("Não foi possível carregar o veículo do seu perfil.");
    const vehicleDescription = data.vehicleDescription?.trim() ||
      [profile.vehicle_brand, profile.vehicle_description].filter(Boolean).join(" · ");
    if (!vehicleDescription) {
      throw new Error("Informe o veículo antes de publicar a oferta.");
    }
    if (!data.quoteId) throw new Error("Aguarde o preço do percurso antes de publicar.");
    const { data: offerId, error } = await context.supabase.rpc("publish_priced_offer", {
      p_quote_id: data.quoteId,
      p_details: { ...data, vehicleDescription, totalPrice: 0 },
      p_preferences: data.preferences,
    });
    if (error) {
      throw new Error(`Não foi possível criar a oferta: ${error.message}`);
    }
    return { offerId };
  });
