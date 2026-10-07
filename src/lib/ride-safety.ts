import { z } from "zod";

export const boardingPinSchema = z.string().regex(/^[0-9]{8}$/, "Informe o PIN de 8 dígitos.");
export const ridePositionSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyM: z.number().finite().min(0).max(10000),
  capturedAt: z.string().datetime(),
});
export const rideRatingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000),
});
export const rideSafetySchema = z.object({
  status: z.string(),
  boardedAt: z.string().nullable(),
  pin: boardingPinSchema.nullable(),
  locations: z.array(
    ridePositionSchema.extend({
      userId: z.string(),
      updatedAt: z.string(),
      capturedAt: z.string(),
    }),
  ),
  completionConfirmed: z.boolean(),
  myRating: rideRatingSchema.nullable(),
  receivedRating: rideRatingSchema.nullable(),
  otherUserRating: z.object({ average: z.number().nullable(), count: z.number().int().min(0) }),
  myUserRating: z.object({ average: z.number().nullable(), count: z.number().int().min(0) }),
});
export type RideSafety = z.infer<typeof rideSafetySchema>;
export type RidePosition = z.infer<typeof ridePositionSchema>;

export function geolocationErrorMessage(code: number): string {
  if (code === 1)
    return "Permissão de localização negada. Autorize o acesso nas configurações do navegador.";
  if (code === 2) return "GPS indisponível. Verifique se a localização do aparelho está ativada.";
  return "Não foi possível obter a posição a tempo. Tente atualizar novamente.";
}

export function getCurrentRidePosition(): Promise<RidePosition> {
  if (!globalThis.navigator?.geolocation)
    return Promise.reject(new Error("Geolocalização indisponível neste navegador."));
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          resolve(
            ridePositionSchema.parse({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyM: position.coords.accuracy,
              capturedAt: new Date(position.timestamp).toISOString(),
            }),
          );
        } catch {
          reject(new Error("O GPS retornou uma posição inválida."));
        }
      },
      (error) => reject(new Error(geolocationErrorMessage(error.code))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    ),
  );
}
