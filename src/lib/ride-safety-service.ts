import { supabase } from "@/integrations/supabase/client";
import {
  boardingPinSchema,
  ridePositionSchema,
  rideRatingSchema,
  rideSafetySchema,
  transitStageSchema,
  type RidePosition,
  type TransitStage,
} from "./ride-safety";

async function unwrap<T>(
  result: PromiseLike<{ data: T; error: { message: string; code: string } | null }>,
) {
  const { data, error } = await result;
  if (error) {
    if (error.code === "23505") throw new Error("Você já avaliou esta corrida.");
    throw new Error(error.message);
  }
  return data;
}

export async function getRideSafety(rideId: string) {
  return rideSafetySchema.parse(
    await unwrap(supabase.rpc("get_ride_safety", { p_ride_id: rideId })),
  );
}

export async function validateRideBoarding(rideId: string, pin: string) {
  const result = await unwrap(
    supabase.rpc("validate_ride_boarding", {
      p_ride_id: rideId,
      p_code: boardingPinSchema.parse(pin),
    }),
  );
  if (result === "INVALID_PIN")
    throw new Error("PIN incorreto. Confira o código com o passageiro.");
  if (result === "LOCKED")
    throw new Error("Limite de tentativas atingido. Aguarde 5 minutos para tentar novamente.");
  if (result !== "IN_PROGRESS") throw new Error("Não foi possível validar o embarque.");
}

export async function updateRideTransitStage(
  rideId: string,
  stage: "DRIVER_EN_ROUTE" | "AWAITING_BOARDING",
): Promise<TransitStage> {
  const validated = transitStageSchema.parse(stage);
  const result = await unwrap(
    supabase.rpc("update_ride_transit_stage", {
      p_ride_id: rideId,
      p_stage: validated,
    }),
  );
  return result as TransitStage;
}

export async function revokeRideLocation(rideId: string): Promise<void> {
  await unwrap(
    supabase.rpc("revoke_ride_location", {
      p_ride_id: rideId,
    }),
  );
}

export async function updateRideLocation(rideId: string, input: RidePosition) {
  const position = ridePositionSchema.parse(input);
  await unwrap(
    supabase.rpc("update_ride_location", {
      p_ride_id: rideId,
      p_latitude: position.latitude,
      p_longitude: position.longitude,
      p_accuracy_m: position.accuracyM,
      p_captured_at: position.capturedAt,
    }),
  );
}

export async function rateRide(rideId: string, score: number, comment: string) {
  const rating = rideRatingSchema.parse({ score, comment });
  await unwrap(
    supabase.rpc("rate_ride", {
      p_ride_id: rideId,
      p_score: rating.score,
      p_comment: rating.comment,
    }),
  );
}
