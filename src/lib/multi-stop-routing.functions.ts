import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDrivingRoute } from "./road-routing";
import { buildSuggestedRoutePlan, type MultiStopCandidate } from "./multi-stop-routing";

const inputSchema = z.object({ offerId: z.string().uuid() });
type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: { message: string } | null };
type Query = PromiseLike<QueryResult> & {
  eq(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
  maybeSingle(): Promise<QueryResult>;
};

/** A read-only route plan for already-persisted proposals. */
export const getDriverOfferRoutePlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const participantClient = context.supabase as unknown as {
      from(table: string): { select(columns: string): Query };
    };
    const { data: offerValue, error: offerError } = await participantClient
      .from("ride_offers")
      .select(
        "offer_id, user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, status, available_seats, route_distance_km, route_path, route_duration_minutes",
      )
      .eq("offer_id", data.offerId)
      .maybeSingle();
    const offer = offerValue as Row | null;
    if (offerError || !offer || offer.user_id !== context.userId) {
      throw new Error("Esta oferta não está disponível para sua conta.");
    }
    if (!["available", "full"].includes(String(offer.status))) {
      return {
        ok: false as const,
        reason: "Esta publicação não está ativa para organizar uma nova rota.",
        rejectedRequestIds: [],
      };
    }
    if (!Array.isArray(offer.route_path) || offer.route_path.length < 2) {
      return {
        ok: false as const,
        reason:
          "Esta oferta foi publicada antes do armazenamento do corredor rodoviário. Publique uma nova oferta para usar a sugestão multi-paradas.",
        rejectedRequestIds: [],
      };
    }

    const { data: rideValues, error: ridesError } = await participantClient
      .from("rides")
      .select(
        "ride_id, request_id, offer_id, driver_user_id, passenger_user_id, status, passenger_accepted_at, driver_accepted_at, route_distance_km, passenger_price, passenger_group_total",
      )
      .eq("offer_id", data.offerId)
      .eq("driver_user_id", context.userId)
      .eq("status", "MATCHED");
    if (ridesError) throw new Error("Não foi possível carregar as propostas desta oferta.");
    const rides = (Array.isArray(rideValues) ? rideValues : []) as Row[];
    const acceptedRides = rides.filter(
      (ride) => Boolean(ride.passenger_accepted_at) && !ride.driver_accepted_at,
    );
    if (acceptedRides.length === 0) {
      return {
        ok: false as const,
        reason: "Não há propostas aguardando sua confirmação após o aceite do passageiro.",
        rejectedRequestIds: [],
      };
    }
    if (acceptedRides.length > 6) {
      return {
        ok: false as const,
        reason: "Há propostas demais para calcular uma sugestão segura de uma só vez.",
        rejectedRequestIds: acceptedRides.map((ride) => String(ride.request_id)),
      };
    }

    // Service-role access is limited to IDs from participant-visible rides,
    // after RLS confirmed both offer ownership and driver participation.
    const requestIds = acceptedRides.map((ride) => String(ride.request_id)).filter(Boolean);
    const passengerIds = [
      ...new Set(acceptedRides.map((ride) => String(ride.passenger_user_id)).filter(Boolean)),
    ];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from(table: string): { select(columns: string): Query };
    };
    const [
      { data: requestValues, error: requestError },
      { data: profileValues, error: profileError },
    ] = await Promise.all([
      admin
        .from("ride_requests")
        .select(
          "request_id, user_id, origin_lat, origin_lng, destination_lat, destination_lng, passenger_count",
        )
        .in("request_id", requestIds),
      admin.from("profiles").select("id, full_name").in("id", passengerIds),
    ]);
    if (requestError || profileError)
      throw new Error("Não foi possível carregar os pontos das propostas.");

    const requests = (Array.isArray(requestValues) ? requestValues : []) as Row[];
    const profiles = (Array.isArray(profileValues) ? profileValues : []) as Row[];
    const requestById = new Map(requests.map((row) => [String(row.request_id), row]));
    const profileById = new Map(profiles.map((row) => [String(row.id), row]));
    const candidates: MultiStopCandidate[] = [];
    for (const ride of acceptedRides) {
      const request = requestById.get(String(ride.request_id));
      if (!request || request.user_id !== ride.passenger_user_id) continue;
      const pickup = coordinate(request, "origin");
      const dropoff = coordinate(request, "destination");
      const passengerCount = Number(request.passenger_count);
      const roadDistanceKm = Number(ride.route_distance_km);
      const pricePerPassenger = Number(ride.passenger_price);
      const groupTotal = Number(ride.passenger_group_total);
      if (
        !pickup ||
        !dropoff ||
        !Number.isInteger(passengerCount) ||
        !Number.isFinite(roadDistanceKm) ||
        !Number.isFinite(pricePerPassenger) ||
        !Number.isFinite(groupTotal)
      )
        continue;
      const fullName = profileById.get(String(ride.passenger_user_id))?.full_name;
      candidates.push({
        requestId: String(request.request_id),
        passengerName:
          typeof fullName === "string" && fullName.trim() ? fullName.trim() : "Passageiro",
        passengerCount,
        pickup,
        dropoff,
        roadDistanceKm,
        pricePerPassenger,
        groupTotal,
      });
    }
    if (candidates.length === 0) {
      return {
        ok: false as const,
        reason:
          "As propostas ainda não têm coordenadas e cotações rodoviárias suficientes para organizar as paradas.",
        rejectedRequestIds: [],
      };
    }
    const requestedSeats = candidates.reduce((sum, candidate) => sum + candidate.passengerCount, 0);
    if (requestedSeats > Number(offer.available_seats)) {
      return {
        ok: false as const,
        reason:
          "A quantidade de vagas das propostas excede a capacidade publicada; não é seguro sugerir uma rota.",
        rejectedRequestIds: candidates.map((candidate) => candidate.requestId),
      };
    }

    const origin = coordinate(offer, "origin");
    const destination = coordinate(offer, "destination");
    if (!origin || !destination) {
      return {
        ok: false as const,
        reason: "A oferta não possui coordenadas confiáveis para calcular seu corredor rodoviário.",
        rejectedRequestIds: [],
      };
    }
    const originalRoute = {
      distanceKm: Number(offer.route_distance_km),
      durationMinutes: Number(offer.route_duration_minutes),
      routePath: offer.route_path as Array<{ lat: number; lng: number }>,
      legs: [
        {
          distanceKm: Number(offer.route_distance_km),
          durationMinutes: Number(offer.route_duration_minutes),
        },
      ],
    };
    if (
      !Number.isFinite(originalRoute.distanceKm) ||
      !Number.isFinite(originalRoute.durationMinutes)
    ) {
      return {
        ok: false as const,
        reason: "A cotação da oferta não contém distância e tempo rodoviários válidos.",
        rejectedRequestIds: [],
      };
    }

    // Also verify endpoint consistency before sending passenger coordinates to Google Maps.
    const routeStart = originalRoute.routePath[0];
    const routeEnd = originalRoute.routePath[originalRoute.routePath.length - 1];
    if (distanceKm(routeStart, origin) > 2 || distanceKm(routeEnd, destination) > 2) {
      return {
        ok: false as const,
        reason:
          "A geometria salva não corresponde aos pontos da oferta; solicite uma nova cotação.",
        rejectedRequestIds: [],
      };
    }

    return buildSuggestedRoutePlan({
      originalRoute,
      candidates,
      route: (points) => getDrivingRoute(points),
    });
  });

function coordinate(row: Row, prefix: "origin" | "destination") {
  const lat = Number(row[`${prefix}_lat`]);
  const lng = Number(row[`${prefix}_lng`]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

