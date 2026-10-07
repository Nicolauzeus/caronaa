import type { NotificationSound } from "./notification-sound";

export type RideAlert = {
  id: string;
  title: string;
  description: string;
  sound: NotificationSound;
  createdAt: string;
  read: boolean;
};
export const RIDES_UPDATED_EVENT = "caronaa:rides-updated";
export const REALTIME_SCOPES = [
  ["ride_requests", "user_id"],
  ["ride_offers", "user_id"],
  ["rides", "driver_user_id"],
  ["rides", "passenger_user_id"],
  ["ride_matches", "driver_user_id"],
  ["ride_matches", "passenger_user_id"],
] as const;

export function createRideAlert(
  table: string,
  event: string,
  row: Record<string, unknown>,
  old: Record<string, unknown>,
  userId: string,
): RideAlert | null {
  if (event !== "INSERT" && event !== "UPDATE") return null;
  const participant = row["driver_user_id"] === userId || row["passenger_user_id"] === userId;
  let title: string;
  let description: string;
  let sound: NotificationSound;
  if (table === "ride_matches" && event === "INSERT" && participant) {
    const driver = row["driver_user_id"] === userId;
    title = driver ? "Nova solicitação de carona" : "Carona encontrada";
    description = driver
      ? "Um passageiro foi conectado ao seu trajeto."
      : "Seu pedido encontrou um motorista compatível.";
    sound = "request";
  } else if (table === "rides" && participant && row["status"] !== old["status"]) {
    const messages: Record<string, [string, NotificationSound]> = {
      CONFIRMED: ["Carona confirmada", "confirmed"],
      IN_PROGRESS: ["Viagem iniciada", "confirmed"],
      CANCELLED: ["Carona cancelada", "cancelled"],
      COMPLETED: ["Viagem concluída", "confirmed"],
    };
    const message = messages[String(row["status"])];
    if (!message) return null;
    [title, sound] = message;
    description =
      row["status"] === "COMPLETED"
        ? "A avaliação da viagem já está disponível."
        : "Confira os detalhes em Minhas caronas.";
  } else return null;
  const id = row[table === "rides" ? "ride_id" : "match_id"];
  if (typeof id !== "string" || !id) return null;
  return {
    id: `${table}:${id}:${String(row["status"] ?? event)}`,
    title,
    description,
    sound,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

export function readRideAlerts(userId: string): RideAlert[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`caronaa-alerts:${userId}`) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is RideAlert =>
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.description === "string" &&
          typeof item.createdAt === "string" &&
          typeof item.read === "boolean" &&
          ["request", "confirmed", "cancelled", "message"].includes(item.sound),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}
