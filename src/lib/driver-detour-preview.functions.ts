import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDrivingRoute, type RoadPoint } from "./road-routing";
import { projectOntoRoutePath } from "./ride-matching";
import { calculateDriverDetour } from "./driver-detour";

const inputSchema = z.object({ rideId: z.string().uuid() });
const point = (lat: unknown, lng: unknown): RoadPoint | null => {
  if (typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

const previewSchema = z.object({
  detourMinutes: z.number().nonnegative(),
  detourKm: z.number().nonnegative(),
  combinedAddedMinutes: z.number().nonnegative(),
  withinLimits: z.boolean(),
});
export type DriverDetourPreview = z.infer<typeof previewSchema>;
const previewCache = new Map<string, { expiresAt: number; value: DriverDetourPreview }>();
const inFlight = new Map<string, Promise<DriverDetourPreview>>();
const TTL_MS = 90_000;

/**
 * Explicit request only (not background/polling). Authorization occurs before
 * privileged reads; cache is keyed by driver/ride and a short-lived fingerprint.
 */
export const getDriverProposalDetour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const client = context.supabase as any;
    const { data: ride, error } = await client.from("rides")
      .select("ride_id,offer_id,request_id,driver_user_id,status,updated_at")
      .eq("ride_id", data.rideId)
      .eq("driver_user_id", context.userId).single();
    if (error || !ride || ride.status !== "MATCHED")
      throw new Error("Proposta indisponível para avaliação.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [offerResult, requestResult, ridesResult] = await Promise.all([
      supabaseAdmin.from("ride_offers")
        .select("origin_lat,origin_lng,destination_lat,destination_lng,route_duration_minutes,route_distance_km,route_path,updated_at,allow_detours")
        .eq("offer_id", ride.offer_id).single(),
      supabaseAdmin.from("ride_requests")
        .select("origin_lat,origin_lng,destination_lat,destination_lng")
        .eq("request_id", ride.request_id).single(),
      supabaseAdmin.from("rides")
        .select("ride_id,request_id,updated_at")
        .eq("offer_id", ride.offer_id)
        .in("status", ["MATCHED", "CONFIRMED", "IN_PROGRESS"]),
    ]);
    if (offerResult.error || requestResult.error || ridesResult.error)
      throw new Error("Rota não disponível para conferência.");
    const offer = offerResult.data as any;
    const request = requestResult.data as any;
    const o = point(offer?.origin_lat, offer?.origin_lng);
    const d = point(offer?.destination_lat, offer?.destination_lng);
    const p = point(request?.origin_lat, request?.origin_lng);
    const q = point(request?.destination_lat, request?.destination_lng);
    if (!o || !d || !p || !q)
      throw new Error("Origem ou destino sem coordenadas verificadas.");

    const activeRides = (ridesResult.data ?? []) as Array<{ride_id:string;request_id:string;updated_at:string}>;
    const fingerprint = JSON.stringify([
      context.userId, data.rideId, ride.updated_at, offer.updated_at,
      ...activeRides.map(x => [x.ride_id,x.request_id,x.updated_at]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
    ]);
    const cached = previewCache.get(fingerprint);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (inFlight.has(fingerprint)) return inFlight.get(fingerprint)!;

    const calculation = (async () => {
      const savedPath = Array.isArray(offer.route_path) ? offer.route_path : null;
      const parsedPath = savedPath?.map((v: any) => point(v?.lat, v?.lng));
      const canReuseSaved = parsedPath && parsedPath.length >= 2 && parsedPath.every(Boolean) &&
        typeof offer.route_duration_minutes === "number" && offer.route_duration_minutes > 0 &&
        typeof offer.route_distance_km === "number" && offer.route_distance_km > 0;
      const original = canReuseSaved
        ? { routePath: parsedPath as RoadPoint[], durationMinutes: offer.route_duration_minutes as number, distanceKm: offer.route_distance_km as number }
        : await getDrivingRoute([o, d]);
      const otherIds = activeRides
        .filter(x => x.ride_id !== data.rideId)
        .map(x => x.request_id);
      const stops: Array<{ id: string; kind: "pickup" | "dropoff"; point: RoadPoint }> = [
        { id: ride.request_id, kind: "pickup", point: p },
        { id: ride.request_id, kind: "dropoff", point: q },
      ];
      if (otherIds.length) {
        const { data: requests, error: requestError } = await supabaseAdmin.from("ride_requests")
          .select("request_id,origin_lat,origin_lng,destination_lat,destination_lng")
          .in("request_id", otherIds);
        if (requestError || requests?.length !== otherIds.length)
          throw new Error("Paradas existentes indisponíveis.");
        for (const r of requests) {
          const pickup = point(r.origin_lat, r.origin_lng);
          const dropoff = point(r.destination_lat, r.destination_lng);
          if (!pickup || !dropoff) throw new Error("Paradas sem coordenadas verificadas.");
          stops.push({id:r.request_id,kind:"pickup",point:pickup},{id:r.request_id,kind:"dropoff",point:dropoff});
        }
      }
      if (stops.length > 14) throw new Error("Há paradas demais para calcular o desvio.");
      const sorted = stops.map(stop => ({
        ...stop, progress: projectOntoRoutePath(stop.point, original.routePath).progressKm,
      })).sort((a,b) => a.progress-b.progress ||
        (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "pickup" ? -1 : 1));
      const [individual, combined] = await Promise.all([
        getDrivingRoute([o,p,q,d]),
        getDrivingRoute([o,...sorted.map(x=>x.point),d]),
      ]);
      const computed = calculateDriverDetour(
        original.durationMinutes, original.distanceKm,
        individual.durationMinutes, individual.distanceKm,
        combined.durationMinutes,
      );
      if (offer.allow_detours === false && computed.detourMinutes > 0)
        computed.withinLimits = false;
      const value = previewSchema.parse(computed);
      if (previewCache.size > 250) previewCache.clear();
      previewCache.set(fingerprint, { expiresAt: Date.now()+TTL_MS, value });
      return value;
    })().finally(() => inFlight.delete(fingerprint));
    inFlight.set(fingerprint, calculation);
    return calculation;
  });
