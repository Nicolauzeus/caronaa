import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeRideVerification as normalizeVerification, type RideVerification } from "@/lib/ride-verifications";
export type { RideVerification } from "@/lib/ride-verifications";

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
};

const searchInput = z.object({
  origin: z.string().trim().max(160).optional(),
  destination: z.string().trim().max(160).optional(),
  rideDate: z.string().date().optional().or(z.literal("")),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")),
  passengerCount: z.number().int().min(1).max(6).default(1),
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
    avatarUrl:
      typeof profile?.["avatar_url"] === "string" ? profile["avatar_url"] : null,
    city: typeof profile?.["city"] === "string" ? profile["city"] : null,
    verifications: verifications.get(userId) ?? [],
  };
}

async function loadProfiles(client: any, userIds: string[]) {
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
    .select(
      "id, user_id, type, status",
    )
    .in("user_id", uniqueIds)
    .eq("status", "VERIFIED");
  if (verificationError) {
    throw new Error(
      verificationError.message || "Não foi possível carregar vínculos verificados.",
    );
  }

  for (const row of verificationRows ?? []) {
    const parsed = normalizeVerification(row);
    if (!parsed || !isObject(row)) continue;
    const userId = String(row["user_id"]);
    verifications.set(userId, [...(verifications.get(userId) ?? []), parsed]);
  }

  return { profiles, verifications };
}

function mapOffer(
  row: any,
  profile: RideProfile,
  viewerUserId: string,
): RideSummary {
  return {
    id: String(row.offer_id),
    kind: "offer",
    role: "available",
    origin: String(row.origin ?? ""),
    destination: String(row.destination ?? ""),
    rideDate: String(row.ride_date ?? ""),
    departureTime: String(row.departure_time ?? "").slice(0, 5),
    seats: Number(row.available_seats ?? 0),
    seatsRemaining: Number(row.seats_remaining ?? 0),
    status: String(row.status ?? ""),
    createdAt: String(row.created_at ?? ""),
    rideId: null,
    requestId: null,
    offerId: String(row.offer_id),
    driver: profile,
    passenger: null,
    viewerUserId,
  };
}

function mapRequest(
  row: any,
  profile: RideProfile,
  viewerUserId: string,
): RideSummary {
  return {
    id: String(row.request_id),
    kind: "request",
    role: "passenger",
    origin: String(row.origin ?? ""),
    destination: String(row.destination ?? ""),
    rideDate: String(row.ride_date ?? ""),
    departureTime: String(row.departure_time ?? "").slice(0, 5),
    seats: Number(row.passenger_count ?? 0),
    seatsRemaining: null,
    status: String(row.status ?? ""),
    createdAt: String(row.created_at ?? ""),
    rideId: null,
    requestId: String(row.request_id),
    offerId: null,
    driver: null,
    passenger: profile,
    viewerUserId,
  };
}

function mapRide(
  ride: any,
  request: any,
  offer: any,
  passenger: RideProfile,
  driver: RideProfile,
  viewerUserId: string,
): RideSummary {
  return {
    id: String(ride.ride_id),
    kind: "ride",
    role: ride.driver_user_id === viewerUserId ? "driver" : "passenger",
    origin: String(request?.origin ?? offer?.origin ?? ""),
    destination: String(request?.destination ?? offer?.destination ?? ""),
    rideDate: String(request?.ride_date ?? offer?.ride_date ?? ""),
    departureTime: String(request?.departure_time ?? offer?.departure_time ?? "").slice(0, 5),
    seats: Number(request?.passenger_count ?? offer?.available_seats ?? 0),
    seatsRemaining:
      typeof offer?.seats_remaining === "number"
        ? offer.seats_remaining
        : offer?.seats_remaining
          ? Number(offer.seats_remaining)
          : null,
    status: String(ride.status ?? ""),
    createdAt: String(ride.created_at ?? ""),
    rideId: String(ride.ride_id),
    requestId: String(ride.request_id),
    offerId: String(ride.offer_id),
    driver,
    passenger,
    viewerUserId,
  };
}

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function discoverOffers(client: any, userId: string, data: z.infer<typeof searchInput>, limit: number) {
  const { data: rows, error } = await client.rpc("search_available_ride_offers", {
    p_origin: data.origin || null,
    p_destination: data.destination || null,
    p_ride_date: data.rideDate || null,
    p_departure_time: data.departureTime || null,
    p_passenger_count: data.passengerCount,
    p_limit: limit,
  });
  if (error) throw new Error(error.message || "Não foi possível buscar caronas.");
  return ((rows ?? []) as any[]).map((row) =>
    mapOffer(row, {
      id: String(row.user_id),
      fullName: row.full_name || "Usuário CARONAA",
      avatarUrl: row.avatar_url ?? null,
      city: row.city ?? null,
      verifications: (row.verifications ?? []).map(normalizeVerification).filter(Boolean),
    }, userId),
  );
}

export const searchRideOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchInput.parse(input))
  .handler(async ({ context, data }) =>
    discoverOffers(context.supabase, context.userId, data, 30),
  );

export const getHomeRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    discoverOffers(context.supabase, context.userId, searchInput.parse({}), 3),
  );

export const getCurrentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as any;
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
      fullName:
        typeof data?.full_name === "string" && data.full_name.trim()
          ? data.full_name
          : "",
      avatarUrl: typeof data?.avatar_url === "string" ? data.avatar_url : null,
      city: typeof data?.city === "string" ? data.city : null,
    };
  });

export const getMyRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getAdminClient();

    const { data: rides, error: ridesError } = await client
      .from("rides")
      .select(
        "ride_id, match_id, request_id, offer_id, passenger_user_id, driver_user_id, status, created_at, updated_at, completed_at",
      )
      .or(`passenger_user_id.eq.${context.userId},driver_user_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (ridesError) {
      throw new Error(ridesError.message || "Não foi possível carregar suas viagens.");
    }

    const { data: requests, error: requestsError } = await client
      .from("ride_requests")
      .select(
        "request_id, user_id, origin, destination, ride_date, departure_time, passenger_count, status, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (requestsError) {
      throw new Error(requestsError.message || "Não foi possível carregar seus pedidos.");
    }

    const { data: offers, error: offersError } = await client
      .from("ride_offers")
      .select(
        "offer_id, user_id, origin, destination, ride_date, departure_time, available_seats, seats_remaining, status, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (offersError) {
      throw new Error(offersError.message || "Não foi possível carregar suas ofertas.");
    }

    const requestIds = [
      ...((rides ?? []) as any[]).map((ride) => String(ride.request_id)),
      ...((requests ?? []) as any[]).map((request) => String(request.request_id)),
    ];
    const offerIds = [
      ...((rides ?? []) as any[]).map((ride) => String(ride.offer_id)),
      ...((offers ?? []) as any[]).map((offer) => String(offer.offer_id)),
    ];

    const { data: matchedRequests, error: matchedRequestsError } = requestIds.length
      ? await client
          .from("ride_requests")
          .select(
            "request_id, user_id, origin, destination, ride_date, departure_time, passenger_count, status, created_at",
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
            "offer_id, user_id, origin, destination, ride_date, departure_time, available_seats, seats_remaining, status, created_at",
          )
          .in("offer_id", [...new Set(offerIds)])
      : { data: [], error: null };
    if (matchedOffersError) {
      throw new Error(matchedOffersError.message || "Não foi possível carregar ofertas.");
    }

    const requestById = new Map(
      ((matchedRequests ?? []) as any[]).map((row) => [
        String(row.request_id),
        row,
      ]),
    );
    const offerById = new Map(
      ((matchedOffers ?? []) as any[]).map((row) => [
        String(row.offer_id),
        row,
      ]),
    );

    const userIds = [
      context.userId,
      ...((rides ?? []) as any[]).flatMap((ride) => [
        String(ride.passenger_user_id),
        String(ride.driver_user_id),
      ]),
    ];
    const { profiles, verifications } = await loadProfiles(client, userIds);

    const matchedRequestIds = new Set(
      ((rides ?? []) as any[]).map((ride) => String(ride.request_id)),
    );
    const matchedOfferIds = new Set(
      ((rides ?? []) as any[]).map((ride) => String(ride.offer_id)),
    );

    const currentProfile = profileFor(context.userId, profiles, verifications);

    const passenger = [
      ...((rides ?? []) as any[])
        .filter((ride) => ride.passenger_user_id === context.userId)
        .map((ride) =>
          mapRide(
            ride,
            requestById.get(String(ride.request_id)),
            offerById.get(String(ride.offer_id)),
            currentProfile,
            profileFor(String(ride.driver_user_id), profiles, verifications),
            context.userId,
          ),
        ),
      ...((requests ?? []) as any[])
        .filter(
          (request) => !matchedRequestIds.has(String(request.request_id)),
        )
        .map((request) =>
          mapRequest(request, currentProfile, context.userId),
        ),
    ];

    const driver = [
      ...((rides ?? []) as any[])
        .filter((ride) => ride.driver_user_id === context.userId)
        .map((ride) =>
          mapRide(
            ride,
            requestById.get(String(ride.request_id)),
            offerById.get(String(ride.offer_id)),
            profileFor(String(ride.passenger_user_id), profiles, verifications),
            currentProfile,
            context.userId,
          ),
        ),
      ...((offers ?? []) as any[])
        .filter(
          (offer) => !matchedOfferIds.has(String(offer.offer_id)),
        )
        .map((offer) => mapOffer(offer, currentProfile, context.userId)),
    ];

    return { passenger, driver };
  });

export const requestRideOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ offerId: z.string().uuid(), passengerCount: z.number().int().min(1).max(6).default(1) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: requestId, error } = await (context.supabase as any).rpc(
      "request_available_ride_offer",
      { p_offer_id: data.offerId, p_passenger_count: data.passengerCount },
    );
    if (error) throw new Error(error.message || "Não foi possível solicitar a carona.");
    return { requestId };
  });
