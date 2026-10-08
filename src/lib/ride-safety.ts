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

export const transitStageSchema = z
  .enum([
    "CONFIRMED",
    "DRIVER_EN_ROUTE",
    "AWAITING_BOARDING",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ])
  .default("CONFIRMED");

export type TransitStage = z.infer<typeof transitStageSchema>;

export const TRANSIT_STAGE_LABELS: Record<TransitStage, string> = {
  CONFIRMED: "Confirmada",
  DRIVER_EN_ROUTE: "Motorista a caminho",
  AWAITING_BOARDING: "Aguardando embarque",
  IN_PROGRESS: "Em viagem",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const TRANSIT_STAGE_DESCRIPTIONS: Record<TransitStage, string> = {
  CONFIRMED: "Ambos os participantes aceitaram a viagem. Trajeto pronto.",
  DRIVER_EN_ROUTE: "O motorista está a caminho do ponto de encontro com o passageiro.",
  AWAITING_BOARDING: "O motorista chegou ao ponto de encontro. Validação de PIN/QR necessária.",
  IN_PROGRESS: "Embarque validado com sucesso. Viagem em andamento até o destino final.",
  COMPLETED: "Chegada ao destino confirmada por ambos os participantes.",
  CANCELLED: "A viagem foi cancelada e os dados de rastreamento foram removidos.",
};

export const rideSafetySchema = z.object({
  status: z.string(),
  transitStage: transitStageSchema.optional().default("CONFIRMED"),
  driverUserId: z.string().uuid().nullable().optional(),
  passengerUserId: z.string().uuid().nullable().optional(),
  boardedAt: z.string().nullable(),
  pin: boardingPinSchema.nullable(),
  locations: z.array(
    ridePositionSchema.extend({
      userId: z.string(),
      updatedAt: z.string(),
      capturedAt: z.string(),
    }),
  ),
  routeDetails: z
    .object({
      origin: z.string(),
      destination: z.string(),
      originLat: z.number().nullable().optional(),
      originLng: z.number().nullable().optional(),
      destinationLat: z.number().nullable().optional(),
      destinationLng: z.number().nullable().optional(),
      passengerOriginLat: z.number().nullable().optional(),
      passengerOriginLng: z.number().nullable().optional(),
      passengerDestinationLat: z.number().nullable().optional(),
      passengerDestinationLng: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
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

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function estimateEtaMinutes(distanceKm: number, avgSpeedKmh = 28): number {
  if (distanceKm <= 0.1) return 1;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}
