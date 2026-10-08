import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Tables } from "@/integrations/supabase/types";
import {
  normalizeRideVerification as normalizeVerification,
  type RideVerification,
} from "@/lib/ride-verifications";
import {
  DEFAULT_GEOGRAPHIC_TOLERANCE_KM,
  areRideLocationsCompatible,
  calculateRideMatchScore,
  isTimeWithinTolerance,
} from "@/lib/ride-matching";
import { searchCatalogLocations } from "@/lib/location/ceara-catalog";
export type { RideVerification } from "@/lib/ride-verifications";

type SupabaseAppClient = SupabaseClient<Database>;

export type RideProfile = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  verifications: RideVerification[];
};

export type RideSummary = {
  id: string;
  kind: "offer" | "request" | "ride";
  role: "driver" | "passenger" | "available";
  origin: string;
  destination: string;
  rideDate: string;
  departureTime: string;
  seats: number;
  seatsRemaining: number | null;
  status: string;
  createdAt: string;
  rideId: string | null;
  requestId: string | null;
  offerId: string | null;
  driver: RideProfile | null;
  passenger: RideProfile | null;
  viewerUserId: string;
  routineId?: string | null;
  scheduleType?: "point" | "routine";
  totalPrice: number;
  confirmedPassengers: number;
  passengerContribution: number;
  matchScore?: number;
};

const searchInput = z.object({
  origin: z.string().trim().max(160).optional(),
  destination: z.string().trim().max(160).optional(),
  originLat: z.number().finite().min(-90).max(90).optional(),
  originLng: z.number().finite().min(-180).max(180).optional(),
  destinationLat: z.number().finite().min(-90).max(90).optional(),
  destinationLng: z.number().finite().min(-180).max(180).optional(),
  rideDate: z.string().date().optional().or(z.literal("")),
  departureTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .or(z.literal("")),
  passengerCount: z.number().int().min(1).max(6).default(1),
  timeToleranceMinutes: z
    .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
    .optional(),
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function profileFor(
  userId: string,
  profiles: Map<string, Record<string, unknown>>,
  verifications: Map<string, RideVerification[]>,
): RideProfile {
  const profile = profiles.get(userId);
  return {
    id: userId,
    fullName:
      typeof profile?.["full_name"] === "string" && profile["full_name"].trim()
        ? profile["full_name"]
        : "Usuário CARONAA",
    avatarUrl: typeof profile?.["avatar_url"] === "string" ? profile["avatar_url"] : null,
    city: typeof profile?.["city"] === "string" ? profile["city"] : null,
    verifications: verifications.get(userId) ?? [],
  };
}

async function loadProfiles(client: SupabaseAppClient, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const profiles = new Map<string, Record<string, unknown>>();
  const verifications = new Map<string, RideVerification[]>();

  if (uniqueIds.length === 0) return { profiles, verifications };

  const { data: profileRows, error: profileError } = await client
    .from("profiles")
    .select("id, full_name, avatar_url, city")
    .in("id", uniqueIds);
  if (profileError) {
    throw new Error(profileError.message || "Não foi possível carregar perfis.");
  }

  for (const row of profileRows ?? []) {
    if (isObject(row)) profiles.set(String(row["id"]), row);
  }

  const { data: verificationRows, error: verificationError } = await client
    .from("user_verifications")
    .select("id, user_id, type, status")
    .in("user_id", uniqueIds)
    .eq("status", "VERIFIED");
  if (verificationError) {
    throw new Error(verificationError.message || "Não foi possível carregar vínculos verificados.");
  }

  for (const row of verificationRows ?? []) {
    const parsed = normalizeVerification(row);
    if (!parsed || !isObject(row)) continue;
    const userId = String(row["user_id"]);
    verifications.set(userId, [...(verifications.get(userId) ?? []), parsed]);
  }

  return { profiles, verifications };
}

type OfferRow = Tables<"ride_offers"> | Record<string, unknown>;
type RequestRow = Tables<"ride_requests"> | Record<string, unknown>;
type RideRow = Tables<"rides"> | Record<string, unknown>;

function coordinateFromInput(lat?: number, lng?: number, label?: string) {
  if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  if (!label?.trim()) return undefined;
  const [match] = searchCatalogLocations(label);
  if (typeof match?.lat === "number" && typeof match.lng === "number") {
    return { lat: match.lat, lng: match.lng };
  }
  return undefined;
}

function coordinateFromRow(row: Record<string, unknown>, prefix: "origin" | "destination") {
  const lat = row[`${prefix}_lat`];
  const lng = row[`${prefix}_lng`];
  if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  if (typeof lat === "string" && typeof lng === "string") {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      return { lat: parsedLat, lng: parsedLng };
    }
  }
  return coordinateFromInput(undefined, undefined, String(row[prefix] ?? ""));
}

function mapOffer(row: OfferRow, profile: RideProfile, viewerUserId: string): RideSummary {
  const r = row as Record<string, unknown>;
  const totalPrice = Number(r["total_price"] ?? 30);
  return {
    ...(typeof r["is_recurring"] === "boolean"
      ? { scheduleType: r["is_recurring"] ? ("routine" as const) : ("point" as const) }
      : {}),
    id: String(r["offer_id"]),
    routineId: typeof r["routine_id"] === "string" ? r["routine_id"] : null,
    kind: "offer",
    role: "available",
    origin: String(r["origin"] ?? ""),
    destination: String(r["destination"] ?? ""),
    rideDate: String(r["ride_date"] ?? ""),
    departureTime: String(r["departure_time"] ?? "").slice(0, 5),
    seats: Number(r["available_seats"] ?? 0),
    seatsRemaining: Number(r["seats_remaining"] ?? 0),
    status: String(r["status"] ?? ""),
    createdAt: String(r["created_at"] ?? ""),
    rideId: null,
    requestId: null,
    offerId: String(r["offer_id"]),
    driver: profile,
    passenger: null,
    viewerUserId,
    totalPrice,
    confirmedPassengers: 0,
    passengerContribution: totalPrice,
  };
}

function mapRequest(row: RequestRow, profile: RideProfile, viewerUserId: string): RideSummary {
  const r = row as Record<string, unknown>;
  const price = Number(r["price"] ?? 0);
  return {
    id: String(r["request_id"]),
    routineId: typeof r["routine_id"] === "string" ? r["routine_id"] : null,
    kind: "request",
    role: "passenger",
    origin: String(r["origin"] ?? ""),
    destination: String(r["destination"] ?? ""),
    rideDate: String(r["ride_date"] ?? ""),
    departureTime: String(r["departure_time"] ?? "").slice(0, 5),
    seats: Number(r["passenger_count"] ?? 0),
    seatsRemaining: null,
    status: String(r["status"] ?? ""),
    createdAt: String(r["created_at"] ?? ""),
    rideId: null,
    requestId: String(r["request_id"]),
    offerId: null,
    driver: null,
    passenger: profile,
    viewerUserId,
    totalPrice: price,
    confirmedPassengers: 1,
    passengerContribution: price,
  };
}

function mapRide(
  ride: RideRow,
  request: RequestRow | undefined,
  offer: OfferRow | undefined,
  passenger: RideProfile,
  driver: RideProfile,
  viewerUserId: string,
  confirmedPassengersCount = 1,
): RideSummary {
  const ri = ride as Record<string, unknown>;
  const req = request as Record<string, unknown> | undefined;
  const off = offer as Record<string, unknown> | undefined;

  const totalPrice = Number(ri["total_price"] ?? off?.["total_price"] ?? 30);
  const status = String(ri["status"] ?? "");
  const confirmedPassengers = status === "CANCELLED" ? 0 : Math.max(1, confirmedPassengersCount);
  const passengerContribution =
    status === "CANCELLED"
      ? 0
      : ri["passenger_contribution"] !== undefined && ri["passenger_contribution"] !== null
        ? Number(ri["passenger_contribution"])
        : Math.round((totalPrice / confirmedPassengers) * 100) / 100;

  return {
    id: String(ri["ride_id"]),
    routineId:
      String((ri["driver_user_id"] === viewerUserId ? off : req)?.["routine_id"] ?? "") || null,
    kind: "ride",
    role: ri["driver_user_id"] === viewerUserId ? "driver" : "passenger",
    origin: String(req?.["origin"] ?? off?.["origin"] ?? ""),
    destination: String(req?.["destination"] ?? off?.["destination"] ?? ""),
    rideDate: String(req?.["ride_date"] ?? off?.["ride_date"] ?? ""),
    departureTime: String(req?.["departure_time"] ?? off?.["departure_time"] ?? "").slice(0, 5),
    seats: Number(req?.["passenger_count"] ?? off?.["available_seats"] ?? 0),
    seatsRemaining:
      typeof off?.["seats_remaining"] === "number"
        ? (off["seats_remaining"] as number)
        : off?.["seats_remaining"]
          ? Number(off["seats_remaining"])
          : null,
    status,
    createdAt: String(ri["created_at"] ?? ""),
    rideId: String(ri["ride_id"]),
    requestId: String(ri["request_id"]),
    offerId: String(ri["offer_id"]),
    driver,
    passenger,
    viewerUserId,
    totalPrice,
    confirmedPassengers,
    passengerContribution,
  };
}

async function getAdminClient(): Promise<SupabaseAppClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseAppClient;
}

async function discoverOffers(
  client: any,
  userId: string,
  data: z.infer<typeof searchInput>,
  limit: number,
) {
  const { error: routineError } = await client.rpc("refresh_ride_routine_occurrences");
  if (routineError) throw new Error(routineError.message);
  const tolerance = data.timeToleranceMinutes ?? 15;
  const { data: rows, error } = await client.rpc("search_available_ride_offers", {
    p_origin: data.origin || undefined,
    p_destination: data.destination || undefined,
    p_origin_lat: data.originLat,
    p_origin_lng: data.originLng,
    p_destination_lat: data.destinationLat,
    p_destination_lng: data.destinationLng,
    p_ride_date: data.rideDate || undefined,
    p_departure_time: data.departureTime || undefined,
    p_passenger_count: data.passengerCount,
    p_limit: limit,
  });
  if (error) throw new Error(error.message || "Não foi possível buscar caronas.");
  let resultRows = (rows ?? []) as any[];
  if (data.departureTime) {
    resultRows = resultRows.filter((row) =>
      isTimeWithinTolerance(
        String(row.departure_time ?? "").slice(0, 5),
        data.departureTime!,
        tolerance,
      ),
    );
  }
  if (data.origin || data.destination) {
    const requestOriginCoordinate = coordinateFromInput(
      data.originLat,
      data.originLng,
      data.origin,
    );
    const requestDestinationCoordinate = coordinateFromInput(
      data.destinationLat,
      data.destinationLng,
      data.destination,
    );
    resultRows = resultRows.filter((row) =>
      areRideLocationsCompatible(
        {
          request: {
            origin: data.origin || "",
            destination: data.destination || "",
            originCoordinate: requestOriginCoordinate,
            destinationCoordinate: requestDestinationCoordinate,
            rideDate: data.rideDate || "",
            departureTime: data.departureTime || "00:00",
            passengerCount: data.passengerCount,
            userId: userId,
          },
          offer: {
            origin: String(row.origin ?? ""),
            destination: String(row.destination ?? ""),
            originCoordinate: coordinateFromRow(row, "origin"),
            destinationCoordinate: coordinateFromRow(row, "destination"),
            rideDate: String(row.ride_date ?? ""),
            departureTime: String(row.departure_time ?? "").slice(0, 5),
            availableSeats: Number(row.available_seats ?? 0),
            seatsRemaining: Number(row.seats_remaining ?? 0),
            userId: String(row.user_id ?? ""),
          },
        },
        {
          originToleranceKm: DEFAULT_GEOGRAPHIC_TOLERANCE_KM,
          destinationToleranceKm: DEFAULT_GEOGRAPHIC_TOLERANCE_KM,
          routeToleranceKm: DEFAULT_GEOGRAPHIC_TOLERANCE_KM,
        },
      ),
    );
  }
  if (resultRows.length) {
    const { data: schedules, error: scheduleError } = await client.rpc("get_offer_schedule_types", {
      p_offer_ids: resultRows.map((row) => String(row.offer_id)),
    });
    if (scheduleError) throw new Error(scheduleError.message);
    const types = new Map<string, boolean>(
      (schedules || []).map((row: { offer_id: string; is_recurring: boolean }) => [
        row.offer_id,
        row.is_recurring,
      ]),
    );
    resultRows = resultRows.map((row) =>
      types.has(String(row.offer_id))
        ? { ...row, is_recurring: types.get(String(row.offer_id)) }
        : row,
    );
  }
  return resultRows
    .map((row: any) => ({
      row,
      score: calculateRideMatchScore({
        request: { origin: data.origin || "", destination: data.destination || "", originCoordinate: coordinateFromInput(data.originLat, data.originLng, data.origin), destinationCoordinate: coordinateFromInput(data.destinationLat, data.destinationLng, data.destination), rideDate: data.rideDate || "", departureTime: data.departureTime || String(row.departure_time ?? "").slice(0, 5), passengerCount: data.passengerCount, userId },
        offer: { origin: String(row.origin ?? ""), destination: String(row.destination ?? ""), originCoordinate: coordinateFromRow(row, "origin"), destinationCoordinate: coordinateFromRow(row, "destination"), rideDate: String(row.ride_date ?? ""), departureTime: String(row.departure_time ?? "").slice(0, 5), availableSeats: Number(row.available_seats ?? 0), seatsRemaining: Number(row.seats_remaining ?? 0), userId: String(row.user_id ?? "") },
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ row, score }: any) => ({ ...mapOffer(
      row,
      {
        id: String(row.user_id),
        fullName: row.full_name || "Usuário CARONAA",
        avatarUrl: row.avatar_url ?? null,
        city: row.city ?? null,
        verifications: (Array.isArray(row.verifications) ? row.verifications : [])
          .map(normalizeVerification)
          .filter((v: RideVerification | null): v is RideVerification => Boolean(v)),
      },
      userId,
    ), matchScore: score }));
}

export const searchRideOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchInput.parse(input))
  .handler(async ({ context, data }) => discoverOffers(context.supabase, context.userId, data, 30));

export const getHomeRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    discoverOffers(context.supabase, context.userId, searchInput.parse({}), 3),
  );

export const getCurrentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase;
    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, avatar_url, city")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Não foi possível carregar seu perfil.");
    }

    return {
      id: context.userId,
      fullName: typeof data?.full_name === "string" && data.full_name.trim() ? data.full_name : "",
      avatarUrl: typeof data?.avatar_url === "string" ? data.avatar_url : null,
      city: typeof data?.city === "string" ? data.city : null,
    };
  });

export const getMyRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error: routineError } = await context.supabase.rpc("refresh_ride_routine_occurrences");
    if (routineError) throw new Error(routineError.message);
    const client = await getAdminClient();

    const { data: rides, error: ridesError } = await client
      .from("rides")
      .select(
        "ride_id, match_id, request_id, offer_id, passenger_user_id, driver_user_id, status, created_at, updated_at, completed_at, total_price, passenger_contribution",
      )
      .or(`passenger_user_id.eq.${context.userId},driver_user_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (ridesError) {
      throw new Error(ridesError.message || "Não foi possível carregar suas viagens.");
    }

    const { data: requests, error: requestsError } = await client
      .from("ride_requests")
      .select(
        "request_id, user_id, origin, destination, ride_date, departure_time, passenger_count, status, created_at, price, routine_id",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (requestsError) {
      throw new Error(requestsError.message || "Não foi possível carregar seus pedidos.");
    }

    const { data: offers, error: offersError } = await client
      .from("ride_offers")
      .select(
        "offer_id, user_id, origin, destination, ride_date, departure_time, available_seats, seats_remaining, status, created_at, total_price, routine_id",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (offersError) {
      throw new Error(offersError.message || "Não foi possível carregar suas ofertas.");
    }

    const requestIds = [
      ...(rides ?? []).map((ride) => String(ride.request_id)),
      ...(requests ?? []).map((request) => String(request.request_id)),
    ];
    const offerIds = [
      ...(rides ?? []).map((ride) => String(ride.offer_id)),
      ...(offers ?? []).map((offer) => String(offer.offer_id)),
    ];

    const { data: matchedRequests, error: matchedRequestsError } = requestIds.length
      ? await client
          .from("ride_requests")
          .select(
            "request_id, user_id, origin, destination, ride_date, departure_time, passenger_count, status, created_at, price, routine_id",
          )
          .in("request_id", [...new Set(requestIds)])
      : { data: [], error: null };
    if (matchedRequestsError) {
      throw new Error(matchedRequestsError.message || "Não foi possível carregar pedidos.");
    }

    const { data: matchedOffers, error: matchedOffersError } = offerIds.length
      ? await client
          .from("ride_offers")
          .select(
            "offer_id, user_id, origin, destination, ride_date, departure_time, available_seats, seats_remaining, status, created_at, total_price, routine_id",
          )
          .in("offer_id", [...new Set(offerIds)])
      : { data: [], error: null };
    if (matchedOffersError) {
      throw new Error(matchedOffersError.message || "Não foi possível carregar ofertas.");
    }

    const requestById = new Map(
      (matchedRequests ?? []).map((row) => [String(row.request_id), row]),
    );
    const offerById = new Map((matchedOffers ?? []).map((row) => [String(row.offer_id), row]));

    // Calcula total de passageiros confirmados/ativos por oferta
    const confirmedCountByOffer = new Map<string, number>();
    for (const r of rides ?? []) {
      if (r.status !== "CANCELLED") {
        const offId = String(r.offer_id);
        const reqRow = requestById.get(String(r.request_id));
        const count = Number(
          (reqRow as Record<string, unknown> | undefined)?.["passenger_count"] ?? 1,
        );
        confirmedCountByOffer.set(offId, (confirmedCountByOffer.get(offId) ?? 0) + count);
      }
    }

    const userIds = [
      context.userId,
      ...(rides ?? []).flatMap((ride) => [
        String(ride.passenger_user_id),
        String(ride.driver_user_id),
      ]),
    ];
    const { profiles, verifications } = await loadProfiles(client, userIds);

    const matchedRequestIds = new Set((rides ?? []).map((ride) => String(ride.request_id)));
    const matchedOfferIds = new Set((rides ?? []).map((ride) => String(ride.offer_id)));

    const currentProfile = profileFor(context.userId, profiles, verifications);

    const passenger = [
      ...(rides ?? [])
        .filter((ride) => ride.passenger_user_id === context.userId)
        .map((ride) =>
          mapRide(
            ride,
            requestById.get(String(ride.request_id)),
            offerById.get(String(ride.offer_id)),
            currentProfile,
            profileFor(String(ride.driver_user_id), profiles, verifications),
            context.userId,
            confirmedCountByOffer.get(String(ride.offer_id)) ?? 1,
          ),
        ),
      ...(requests ?? [])
        .filter((request) => !matchedRequestIds.has(String(request.request_id)))
        .map((request) => mapRequest(request, currentProfile, context.userId)),
    ];

    const driver = [
      ...(rides ?? [])
        .filter((ride) => ride.driver_user_id === context.userId)
        .map((ride) =>
          mapRide(
            ride,
            requestById.get(String(ride.request_id)),
            offerById.get(String(ride.offer_id)),
            profileFor(String(ride.passenger_user_id), profiles, verifications),
            currentProfile,
            context.userId,
            confirmedCountByOffer.get(String(ride.offer_id)) ?? 1,
          ),
        ),
      ...(offers ?? [])
        .filter((offer) => !matchedOfferIds.has(String(offer.offer_id)))
        .map((offer) => mapOffer(offer, currentProfile, context.userId)),
    ];

    return { passenger, driver };
  });

export const requestRideOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        passengerCount: z.number().int().min(1).max(6).default(1),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: requestId, error } = await context.supabase.rpc("request_available_ride_offer", {
      p_offer_id: data.offerId,
      p_passenger_count: data.passengerCount,
    });
    if (error) throw new Error(error.message || "Não foi possível solicitar a carona.");
    return { requestId };
  });
