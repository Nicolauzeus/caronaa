import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { travelPreferencesSchema } from "./travel-preferences";

export const rideInput = z
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
    availableSeats: z.number().int().min(1).max(4).optional(),
    vehicleType: z.enum(["CAR", "MOTO"]).default("CAR"),
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
    allowDetours: z.boolean().default(true),
  })
  .superRefine((data, context) => {
    if (data.vehicleType === "MOTO" && data.availableSeats !== 1) {
      context.addIssue({ code: "custom", message: "Moto permite apenas uma vaga." });
    }
    if ((data.meetingLat == null) !== (data.meetingLng == null)) {
      context.addIssue({
        code: "custom",
        message: "Informe as duas coordenadas do ponto de encontro.",
      });
    }
  });

export const pricedRequestInput = z
  .object({
    vehicleType: z.enum(["CAR", "MOTO"]).default("CAR"),
    womenOnly: z.boolean().default(false),
    quoteId: z.string().uuid(),
    rideDate: z.string().date(),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    passengerCount: z.number().int().min(1).max(6).default(1),
    timeToleranceMinutes: z
      .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
      .default(15),
    preferences: travelPreferencesSchema.optional(),
  })
  .superRefine((data, context) => {
    if (data.vehicleType === "MOTO" && data.passengerCount !== 1)
      context.addIssue({
        code: "custom",
        message: "Moto permite apenas uma passageira ou passageiro.",
      });
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
    const { data: requestId, error } = await client.rpc("create_filtered_priced_ride_request", {
      p_vehicle_type: data.vehicleType,
      p_women_only: data.womenOnly,
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
    const { error: policyError } = await (context.supabase as any)
      .from("ride_offers")
      .select("allow_detours,vehicle_type")
      .limit(0);
    if (policyError)
      throw new Error("Aplique as migrações 0136 e 0137 antes de publicar a viagem.");
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("vehicle_brand, vehicle_description, gender")
      .eq("id", context.userId)
      .single();
    if (profileError) throw new Error("Não foi possível carregar o veículo do seu perfil.");
    if (data.passengerGenderPreference === "FEMININO" && profile.gender !== "FEMININO") {
      throw new Error("Preferência indisponível para este perfil.");
    }
    const vehicleDescription =
      data.vehicleDescription?.trim() ||
      (data.vehicleType === "MOTO"
        ? ""
        : [profile.vehicle_brand, profile.vehicle_description].filter(Boolean).join(" · "));
    if (!vehicleDescription) {
      throw new Error("Informe o veículo antes de publicar a oferta.");
    }
    if (!data.quoteId) throw new Error("Aguarde o preço do percurso antes de publicar.");
    const { data: offerId, error } = await (context.supabase as any).rpc(
      "publish_filtered_priced_offer",
      {
        p_quote_id: data.quoteId,
        p_details: { ...data, vehicleDescription, totalPrice: 0 },
        p_preferences: data.preferences,
      },
    );
    if (error) {
      throw new Error(`Não foi possível criar a oferta: ${error.message}`);
    }
    if (typeof offerId !== "string")
      throw new Error("A publicação retornou um identificador inválido.");
    return { offerId };
  });
