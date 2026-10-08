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
  } else if (table === "rides" && participant) {
    const stage = String(row["transit_stage"] ?? "");
    const oldStage = String(old["transit_stage"] ?? "");
    const status = String(row["status"] ?? "");
    const oldStatus = String(old["status"] ?? "");

    if (stage && stage !== oldStage && stage === "DRIVER_EN_ROUTE") {
      title = "Motorista a caminho";
      description = "O motorista iniciou o deslocamento para o ponto de encontro.";
      sound = "confirmed";
    } else if (stage && stage !== oldStage && stage === "AWAITING_BOARDING") {
      title = "Motorista no ponto de encontro";
      description = "O motorista chegou e está aguardando o seu embarque.";
      sound = "confirmed";
    } else if (status !== oldStatus) {
      const messages: Record<string, [string, NotificationSound]> = {
        CONFIRMED: ["Carona confirmada", "confirmed"],
        IN_PROGRESS: ["Viagem iniciada", "confirmed"],
        CANCELLED: ["Carona cancelada", "cancelled"],
        COMPLETED: ["Viagem concluída", "confirmed"],
      };
      const message = messages[status];
      if (!message) return null;
      [title, sound] = message;
      description =
        status === "COMPLETED"
          ? "A avaliação da viagem já está disponível."
          : "Confira os detalhes em Minhas caronas.";
    } else {
      return null;
    }
  } else if (table === "ride_notifications" && row["user_id"] === userId) {
    const eventName = String(row["event_name"] ?? "");
    if (eventName === "MATCH_PROPOSED") {
      title = "Nova combinação encontrada";
      description = "Abra a proposta e responda dentro do prazo.";
      sound = "request";
    } else if (eventName === "BOTH_ACCEPTED") {
      title = "Carona confirmada por ambos";
      description = "O acompanhamento em tempo real está liberado.";
      sound = "confirmed";
    } else if (eventName === "DRIVER_EN_ROUTE") {
      title = "Motorista a caminho";
      description = "O motorista está a caminho do ponto de encontro.";
      sound = "confirmed";
    } else if (eventName === "DRIVER_ARRIVED") {
      title = "Motorista no ponto de encontro";
      description = "O motorista chegou ao ponto de encontro para o embarque.";
      sound = "confirmed";
    } else if (eventName === "RIDE_CANCELLED") {
      title = "Carona cancelada";
      description = "A viagem foi cancelada pelo outro participante.";
      sound = "cancelled";
    } else if (eventName === "RIDE_COMPLETED") {
      title = "Viagem concluída";
      description = "A viagem foi concluída. Deixe sua avaliação.";
      sound = "confirmed";
    } else {
      return null;
    }
  } else return null;

  const id =
    table === "ride_notifications"
      ? String(row["notification_id"] ?? `${row["ride_id"]}:${row["event_name"]}`)
      : row[table === "rides" ? "ride_id" : "match_id"];
  if (typeof id !== "string" || !id) return null;

  const stateToken =
    table === "ride_notifications"
      ? String(row["event_name"] ?? "")
      : row["transit_stage"] && row["transit_stage"] !== old["transit_stage"]
        ? String(row["transit_stage"])
        : String(row["status"] ?? event);

  return {
    id: `${table}:${id}:${stateToken}`,
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
