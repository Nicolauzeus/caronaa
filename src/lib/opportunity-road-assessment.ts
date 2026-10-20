import { z } from "zod";
import { getDrivingRoute, type RoadPoint } from "./road-routing";
import { projectOntoRoutePath } from "./ride-matching";

const pointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
const contextSchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  pickup: pointSchema,
  dropoff: pointSchema,
  routePath: z.array(pointSchema).nullable(),
  durationMinutes: z.number().positive().nullable(),
  distanceKm: z.number().positive().nullable(),
  inventoryVersion: z.string(),
});
type Client = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Validate a prospective passenger against all currently reserved/confirmed stops. */
export async function assessOpportunityRoadRoute(
  participantClient: Client,
  userId: string,
  input: { offerId: string; quoteId?: string; requestId?: string },
) {
  // Always authorize through the participant before any privileged reads/writes.
  const { data, error } = await participantClient.rpc("get_opportunity_route_context", {
    p_offer_id: input.offerId,
    p_quote_id: input.quoteId,
    p_request_id: input.requestId,
  });
  if (error) {
    if (/quote.*expired/i.test(error.message))
      throw new Error(
        "A cotação do trecho expirou. Atualize o preço antes de solicitar novamente.",
      );
    throw new Error("A oportunidade mudou ou não está disponível para sua conta.");
  }
  if (
    data &&
    typeof data === "object" &&
    "alreadyRequested" in data &&
    data.alreadyRequested === true
  )
    return;
  const context = contextSchema.safeParse(data);
  if (!context.success)
    throw new Error(
      "Esta oportunidade não tem coordenadas suficientes para verificar o percurso por estrada.",
    );
  const route = context.data;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rides, error: ridesError } = await supabaseAdmin
    .from("rides")
    .select("request_id")
    .eq("offer_id", input.offerId)
    .in("status", ["MATCHED", "CONFIRMED", "IN_PROGRESS"]);
  if (ridesError) throw new Error("Não foi possível conferir as paradas já reservadas.");
  const requestIds = (rides ?? []).map((ride) => ride.request_id);
  const stops: Array<{ id: string; kind: "pickup" | "dropoff"; point: RoadPoint }> = [
    { id: "prospective", kind: "pickup", point: route.pickup },
    { id: "prospective", kind: "dropoff", point: route.dropoff },
  ];
  if (requestIds.length) {
    const { data: requests, error: requestsError } = await supabaseAdmin
      .from("ride_requests")
      .select("request_id,origin_lat,origin_lng,destination_lat,destination_lng")
      .in("request_id", requestIds);
    if (requestsError || requests?.length !== requestIds.length)
      throw new Error("Não foi possível conferir todas as paradas da oferta.");
    for (const request of requests) {
      const pickup = pointSchema.safeParse({ lat: request.origin_lat, lng: request.origin_lng });
      const dropoff = pointSchema.safeParse({
        lat: request.destination_lat,
        lng: request.destination_lng,
      });
      if (!pickup.success || !dropoff.success)
        throw new Error("Uma parada existente ainda não tem coordenadas para verificar o trajeto.");
      stops.push(
        { id: request.request_id, kind: "pickup", point: pickup.data },
        { id: request.request_id, kind: "dropoff", point: dropoff.data },
      );
    }
  }
  if (stops.length > 14) throw new Error("Há paradas demais para avaliar esta oportunidade.");
  try {
    const original =
      route.routePath && route.durationMinutes && route.distanceKm
        ? { routePath: route.routePath, durationMinutes: route.durationMinutes }
        : await getDrivingRoute([route.origin, route.destination]);
    const ordered = stops
      .map((stop) => ({
        ...stop,
        progress: projectOntoRoutePath(stop.point, original.routePath).progressKm,
      }))
      .sort(
        (a, b) =>
          a.progress - b.progress ||
          (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "pickup" ? -1 : 1),
      );
    const [individual, combined] = await Promise.all([
      getDrivingRoute([route.origin, route.pickup, route.dropoff, route.destination]),
      getDrivingRoute([route.origin, ...ordered.map((stop) => stop.point), route.destination]),
    ]);
    const individualAdded = Math.max(0, individual.durationMinutes - original.durationMinutes);
    const combinedAdded = Math.max(0, combined.durationMinutes - original.durationMinutes);
    if (individualAdded > 6 || combinedAdded > 15)
      throw new Error(
        "Esta oportunidade exige um desvio acima do limite: 6 minutos por pedido ou 15 minutos no conjunto das paradas.",
      );
    const client = supabaseAdmin as unknown as {
      from(table: string): {
        insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>;
      };
    };
    const { error: saveError } = await client.from("ride_road_assessments").insert({
      user_id: userId,
      offer_id: input.offerId,
      quote_id: input.quoteId ?? null,
      request_id: input.requestId ?? null,
      inventory_version: route.inventoryVersion,
      added_duration_minutes: combinedAdded,
    });
    if (saveError) throw new Error("Não foi possível salvar a verificação do trajeto.");
  } catch (cause) {
    if (cause instanceof Error && /desvio acima|salvar a verificação/.test(cause.message))
      throw cause;
    throw new Error(
      "Não foi possível verificar o trajeto por estrada. Nenhuma vaga foi reservada; tente novamente.",
    );
  }
}
