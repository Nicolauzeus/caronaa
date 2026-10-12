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
  getRideMatchReasons,
  isTimeWithinTolerance,
} from "@/lib/ride-matching";
import { searchCatalogLocations } from "@/lib/location/ceara-catalog";
import { sumConfirmedGroupFares } from "@/lib/ride-cost";
import { canViewRideCounterpartProfile } from "@/lib/ride-profile-access";
import { compareRideRecency } from "@/lib/ride-order";
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
  updatedAt: string;
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
  routeDistanceKm?: number | null;
  offerRouteDistanceKm?: number | null;
  offerReferencePrice?: number | null;
  pricePerPassenger?: number | null;
  groupTotal?: number | null;
  tariffReference?: string | null;
  driverConfirmedTotal?: number | null;
  driverAcceptedAt?: string | null;
  passengerAcceptedAt?: string | null;
  responseExpiresAt?: string | null;
  matchScore?: number;
  preferenceBonus?: number;
  matchReasons?: string[];
  vehicleDescription?: string | null;
  meetingPoint?: string | null;
  meetingLat?: number | null;
  meetingLng?: number | null;
  notes?: string | null;
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
    updatedAt: String(r["updated_at"] ?? r["created_at"] ?? ""),
    rideId: null,
    requestId: null,
    offerId: String(r["offer_id"]),
    driver: profile,
    passenger: null,
    viewerUserId,
    totalPrice,
    confirmedPassengers: 0,
    passengerContribution: totalPrice,
    routeDistanceKm: r["route_distance_km"] == null ? null : Number(r["route_distance_km"]),
    offerRouteDistanceKm: r["route_distance_km"] == null ? null : Number(r["route_distance_km"]),
    offerReferencePrice: r["passenger_price"] == null ? null : Number(r["passenger_price"]),
    pricePerPassenger: r["passenger_price"] == null ? null : Number(r["passenger_price"]),
    vehicleDescription:
      typeof r["vehicle_description"] === "string" ? r["vehicle_description"] : null,
    meetingPoint: typeof r["meeting_point"] === "string" ? r["meeting_point"] : null,
    meetingLat: typeof r["meeting_lat"] === "number" ? r["meeting_lat"] : null,
    meetingLng: typeof r["meeting_lng"] === "number" ? r["meeting_lng"] : null,
    notes: typeof r["notes"] === "string" ? r["notes"] : null,
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
    updatedAt: String(r["updated_at"] ?? r["created_at"] ?? ""),
    rideId: null,
    requestId: String(r["request_id"]),
    offerId: null,
    driver: null,
    passenger: profile,
    viewerUserId,
    totalPrice: price,
    confirmedPassengers: 1,
    passengerContribution: price,
    meetingPoint: typeof r["pickup_point"] === "string" ? r["pickup_point"] : null,
    meetingLat: typeof r["pickup_lat"] === "number" ? r["pickup_lat"] : null,
    meetingLng: typeof r["pickup_lng"] === "number" ? r["pickup_lng"] : null,
    notes: typeof r["notes"] === "string" ? r["notes"] : null,
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
  confirmedFareTotal = 0,
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
  const quotedPriceValue = ri["passenger_price"];
  const parsedQuotedPrice = quotedPriceValue == null ? null : Number(quotedPriceValue);
  const quotedPrice =
    parsedQuotedPrice != null && Number.isFinite(parsedQuotedPrice) ? parsedQuotedPrice : null;
  const quotedGroupValue = ri["passenger_group_total"];
  const parsedQuotedGroup = quotedGroupValue == null ? null : Number(quotedGroupValue);
  const quotedGroupTotal =
    parsedQuotedGroup != null && Number.isFinite(parsedQuotedGroup) ? parsedQuotedGroup : null;
  const routeDistanceValue = ri["route_distance_km"];
  const parsedRouteDistance = routeDistanceValue == null ? null : Number(routeDistanceValue);

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
    updatedAt: String(ri["updated_at"] ?? ri["created_at"] ?? ""),
    rideId: String(ri["ride_id"]),
    requestId: String(ri["request_id"]),
    offerId: String(ri["offer_id"]),
    driver,
    passenger,
    viewerUserId,
    totalPrice,
    confirmedPassengers,
    passengerContribution,
    routeDistanceKm:
      parsedRouteDistance != null && Number.isFinite(parsedRouteDistance)
        ? parsedRouteDistance
        : null,
    pricePerPassenger: quotedPrice,
    groupTotal: quotedGroupTotal,
    offerRouteDistanceKm:
      off?.["route_distance_km"] == null ? null : Number(off["route_distance_km"]),
    offerReferencePrice: off?.["passenger_price"] == null ? null : Number(off["passenger_price"]),
    tariffReference: typeof ri["tariff_reference"] === "string" ? ri["tariff_reference"] : null,
    driverConfirmedTotal: ri["driver_user_id"] === viewerUserId ? confirmedFareTotal : null,
    driverAcceptedAt:
      typeof ri["driver_accepted_at"] === "string" ? ri["driver_accepted_at"] : null,
    passengerAcceptedAt:
      typeof ri["passenger_accepted_at"] === "string" ? ri["passenger_accepted_at"] : null,
    responseExpiresAt:
      typeof ri["response_expires_at"] === "string" ? ri["response_expires_at"] : null,
    vehicleDescription:
      typeof off?.["vehicle_description"] === "string" ? off["vehicle_description"] : null,
    meetingPoint:
      typeof req?.["pickup_point"] === "string"
        ? req["pickup_point"]
        : typeof off?.["meeting_point"] === "string"
          ? off["meeting_point"]
          : null,
    meetingLat:
      typeof req?.["pickup_lat"] === "number"
        ? req["pickup_lat"]
        : typeof off?.["meeting_lat"] === "number"
          ? off["meeting_lat"]
          : null,
    meetingLng:
      typeof req?.["pickup_lng"] === "number"
        ? req["pickup_lng"]
        : typeof off?.["meeting_lng"] === "number"
          ? off["meeting_lng"]
          : null,
    notes:
      typeof req?.["notes"] === "string"
        ? req["notes"]
        : typeof off?.["notes"] === "string"
          ? off["notes"]
          : null,
  };
}

async function getAdminClient(): Promise<SupabaseAppClient> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin as unknown as SupabaseAppClient;
  } catch {
    const { supabase } = await import("@/integrations/supabase/client");
    return supabase as unknown as SupabaseAppClient;
  }
}

async function discoverOffers(
  client: SupabaseAppClient,
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
    p_time_tolerance_minutes: tolerance,
  });
  if (error) throw new Error(error.message || "Não foi possível buscar caronas.");
  let resultRows = (rows ?? []) as unknown as Record<string, unknown>[];
  if (data.departureTime) {
    resultRows = resultRows.filter((row) =>
      isTimeWithinTolerance(
        String(row.departure_time ?? "").slice(0, 5),
        data.departureTime ?? "",
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
  const bonuses = new Map<string, number>();
  if (resultRows.length) {
    const { data: prices, error: priceError } = await client.rpc("get_offer_publication_prices", {
      p_offer_ids: resultRows.map((row) => String(row.offer_id)),
    });
    if (priceError) throw new Error("Não foi possível carregar os preços das ofertas.");
    const priceMap = new Map((prices ?? []).map((row) => [row.offer_id, row]));
    resultRows = resultRows.map((row) => ({ ...row, ...priceMap.get(String(row.offer_id)) }));
    const { data: matches, error: bonusError } = await client.rpc("get_offer_preference_bonuses", {
      p_offer_ids: resultRows.map((row) => String(row.offer_id)),
    });
    if (bonusError) throw new Error(bonusError.message);
    for (const item of matches ?? []) bonuses.set(String(item.offer_id), Number(item.bonus));
  }
  return resultRows
    .map((row) => {
      const input = {
        request: {
          origin: data.origin || "",
          destination: data.destination || "",
          originCoordinate: coordinateFromInput(data.originLat, data.originLng, data.origin),
          destinationCoordinate: coordinateFromInput(
            data.destinationLat,
            data.destinationLng,
            data.destination,
          ),
          rideDate: data.rideDate || "",
          departureTime: data.departureTime || String(row.departure_time ?? "").slice(0, 5),
          passengerCount: data.passengerCount,
          userId,
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
      };
      const preferenceBonus = bonuses.get(String(row.offer_id)) ?? 0;
      return {
        row,
        input,
        preferenceBonus,
        score: calculateRideMatchScore(input, preferenceBonus),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ row, input, score, preferenceBonus }) => ({
      ...mapOffer(
        row as OfferRow,
        {
          id: String(row.user_id),
          fullName:
            typeof row.full_name === "string" && row.full_name.trim()
              ? row.full_name
              : "Usuário CARONAA",
          avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
          city: typeof row.city === "string" ? row.city : null,
          verifications: (Array.isArray(row.verifications) ? row.verifications : [])
            .map(normalizeVerification)
            .filter((v: RideVerification | null): v is RideVerification => Boolean(v)),
        },
        userId,
      ),
      matchScore: score,
      preferenceBonus,
      matchReasons: getRideMatchReasons(input, preferenceBonus),
    }));
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
    const client = context.supabase;
    const { error: expiryError } = await client.rpc("expire_ride_match_proposals");
    if (expiryError) {
      console.warn("Could not expire ride match proposals:", expiryError.message);
    }

    const { data: rides, error: ridesError } = await client
      .from("rides")
      .select(
        "ride_id, match_id, request_id, offer_id, passenger_user_id, driver_user_id, status, created_at, updated_at, completed_at, total_price, passenger_contribution, passenger_accepted_at, driver_accepted_at, response_expires_at, route_distance_km, passenger_price, passenger_group_total, tariff_reference",
      )
      .or(`passenger_user_id.eq.${context.userId},driver_user_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (ridesError) {
      throw new Error(ridesError.message || "Não foi possível carregar suas viagens.");
    }

    const { data: requests, error: requestsError } = await client
      .from("ride_requests")
      .select(
        "request_id, user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, pickup_point, pickup_lat, pickup_lng, notes, idempotency_key, ride_date, departure_time, passenger_count, status, created_at, updated_at, price, routine_id",
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (requestsError) {
      throw new Error(requestsError.message || "Não foi possível carregar seus pedidos.");
    }

    const { data: offers, error: offersError } = await client
      .from("ride_offers")
      .select(
        "offer_id, user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, vehicle_description, meeting_point, meeting_lat, meeting_lng, notes, idempotency_key, ride_date, departure_time, available_seats, seats_remaining, status, created_at, updated_at, total_price, route_distance_km, passenger_price, accepts_quoted_fares, routine_id",
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
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
            "request_id, user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, pickup_point, pickup_lat, pickup_lng, notes, idempotency_key, ride_date, departure_time, passenger_count, status, created_at, updated_at, price, routine_id",
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
            "offer_id, user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, vehicle_description, meeting_point, meeting_lat, meeting_lng, notes, idempotency_key, ride_date, departure_time, available_seats, seats_remaining, status, created_at, updated_at, total_price, route_distance_km, passenger_price, accepts_quoted_fares, routine_id",
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
    const confirmedFaresByOffer = new Map<
      string,
      Array<{ status: string; groupTotal: number | null }>
    >();
    for (const r of rides ?? []) {
      if (r.status !== "CANCELLED") {
        const offId = String(r.offer_id);
        const reqRow = requestById.get(String(r.request_id));
        const count = Number(
          (reqRow as Record<string, unknown> | undefined)?.["passenger_count"] ?? 1,
        );
        confirmedCountByOffer.set(offId, (confirmedCountByOffer.get(offId) ?? 0) + count);
      }
      const fareRows = confirmedFaresByOffer.get(String(r.offer_id)) ?? [];
      const rawTotal = (r as unknown as Record<string, unknown>)["passenger_group_total"];
      const parsedGroupTotal = rawTotal == null ? null : Number(rawTotal);
      fareRows.push({
        status: String(r.status),
        groupTotal:
          parsedGroupTotal != null && Number.isFinite(parsedGroupTotal) ? parsedGroupTotal : null,
      });
      confirmedFaresByOffer.set(String(r.offer_id), fareRows);
    }
    const confirmedFareTotalByOffer = new Map(
      [...confirmedFaresByOffer.entries()].map(([offerId, fareRows]) => [
        offerId,
        sumConfirmedGroupFares(fareRows),
      ]),
    );

    const userIds = [
      context.userId,
      ...(rides ?? []).flatMap((ride) => [
        String(ride.passenger_user_id),
        String(ride.driver_user_id),
      ]),
    ];
    const { profiles, verifications } = await loadProfiles(client, userIds);

    const activeRideLinks = (rides ?? []).filter(
      (ride) => !["CANCELLED", "NO_SHOW"].includes(String(ride.status)),
    );
    const matchedRequestIds = new Set(activeRideLinks.map((ride) => String(ride.request_id)));
    const matchedOfferIds = new Set(activeRideLinks.map((ride) => String(ride.offer_id)));

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
            confirmedFareTotalByOffer.get(String(ride.offer_id)) ?? 0,
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
            confirmedFareTotalByOffer.get(String(ride.offer_id)) ?? 0,
          ),
        ),
      ...(offers ?? [])
        .filter((offer) => !matchedOfferIds.has(String(offer.offer_id)))
        .map((offer) => mapOffer(offer, currentProfile, context.userId)),
    ];

    return {
      passenger: passenger.sort(compareRideRecency),
      driver: driver.sort(compareRideRecency),
    };
  });

export const requestRideOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        quoteId: z.string().uuid(),
        rideDate: z.string().date(),
        departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        passengerCount: z.number().int().min(1).max(6).default(1),
        timeToleranceMinutes: z
          .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
          .default(15),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: requestId, error } = await client.rpc("request_available_ride_segment", {
      p_offer_id: data.offerId,
      p_quote_id: data.quoteId,
      p_ride_date: data.rideDate,
      p_departure_time: data.departureTime,
      p_passenger_count: data.passengerCount,
      p_time_tolerance_minutes: data.timeToleranceMinutes,
    });
    if (error) {
      const message = error.message || "";
      if (/quote is invalid or expired/i.test(message)) {
        throw new Error(
          "A cotação do trecho expirou. Atualize o preço antes de solicitar novamente.",
        );
      }
      if (/offer unavailable|offer expired|no longer matches|no seats available/i.test(message)) {
        throw new Error(
          "Esta oferta mudou ou não tem vagas para o seu trecho. Atualize a busca e tente outra carona.",
        );
      }
      throw new Error(message || "Não foi possível solicitar a carona.");
    }
    if (typeof requestId !== "string")
      throw new Error("A solicitação retornou um identificador inválido.");
    return { requestId };
  });

const rideParticipantProfileInput = z.object({
  rideId: z.string().uuid(),
  userId: z.string().uuid(),
});

/** Dados de perfil são liberados apenas entre participantes de uma mesma combinação. */
export const getRideParticipantProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideParticipantProfileInput.parse(input))
  .handler(async ({ context, data }) => {
    const client = await getAdminClient();
    const { data: ride, error: rideError } = await client
      .from("rides")
      .select("passenger_user_id, driver_user_id, offer_id")
      .eq("ride_id", data.rideId)
      .maybeSingle();
    if (rideError || !ride) throw new Error("Combinação não encontrada.");
    const passengerId = String(ride.passenger_user_id);
    const driverId = String(ride.driver_user_id);
    const otherParticipantId = context.userId === passengerId ? driverId : passengerId;
    if (
      !canViewRideCounterpartProfile({
        callerId: context.userId,
        targetId: data.userId,
        passengerId,
        driverId,
      })
    ) {
      throw new Error("Este perfil só pode ser visto pela outra pessoa desta combinação.");
    }

    const [profileResult, verificationResult, ratingResult, offerResult] = await Promise.all([
      client
        .from("profiles")
        .select("id, full_name, avatar_url, city, created_at")
        .eq("id", otherParticipantId)
        .maybeSingle(),
      client
        .from("user_verifications")
        .select("id, user_id, type, status")
        .eq("user_id", otherParticipantId)
        .eq("status", "VERIFIED"),
      client.from("ride_ratings").select("score").eq("rated_user_id", otherParticipantId),
      client
        .from("ride_offers")
        .select("vehicle_description")
        .eq("offer_id", String(ride.offer_id))
        .maybeSingle(),
    ]);
    if (profileResult.error || !profileResult.data)
      throw new Error("Não foi possível carregar este perfil.");
    if (verificationResult.error || ratingResult.error || offerResult.error) {
      throw new Error("Não foi possível carregar os dados de apresentação deste perfil.");
    }
    const scores = (ratingResult.data ?? [])
      .map((row) => Number(row.score))
      .filter(Number.isFinite);
    const verifications = (verificationResult.data ?? [])
      .map((row) => normalizeVerification(row))
      .filter((row): row is RideVerification => Boolean(row));
    return {
      id: otherParticipantId,
      fullName: String(profileResult.data.full_name || "Usuário CARONAA"),
      avatarUrl: profileResult.data.avatar_url,
      city: profileResult.data.city,
      memberSince: profileResult.data.created_at,
      verifications,
      averageRating: scores.length
        ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
        : null,
      ratingCount: scores.length,
      vehicleDescription:
        otherParticipantId === driverId ? (offerResult.data?.vehicle_description ?? null) : null,
    };
  });
