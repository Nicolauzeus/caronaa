import type { ProductEventName } from "./product-events";
import { supabase } from "@/integrations/supabase/client";

export type RideOperationalEvent = {
  eventName: ProductEventName;
  rideId: string | null;
  matchId: string | null;
  status: string | null;
  createdAt: string;
  source?: string | null;
  campaign?: string | null;
  metadata?: Record<string, unknown>;
  trustedSource?: boolean;
};

export type OperationalFilters = {
  periodStart?: string;
  periodEnd?: string;
  origin?: string;
  destination?: string;
  timeWindow?: string;
  profile?: string;
  source?: string;
  campaign?: string;
};

export type OperationalMetrics = {
  request: { eligibleRequests: number; matchedRequests: number; unmatchedRequests: number; requestMatchRate: number };
  offer: { eligibleOffers: number; utilizedOffers: number; unmatchedOffers: number; offerMatchRate: number };
  seats: { availableSeats: number | null; occupiedSeats: number | null; seatFillRate: number | null };
  match: { total: number; averageMinutesToMatch: number | null; cancelled: number; completed: number };
};

const pct = (value: number, total: number) => total ? Math.round((value / total) * 10000) / 100 : 0;
const metadataValue = (event: RideOperationalEvent, field: string) =>
  String(event.metadata?.[field] ?? "").toLowerCase();

/** In-memory reference reducer retained for the SQL aggregation equivalence tests. */
export function buildOperationalMetrics(events: RideOperationalEvent[], filters: OperationalFilters = {}): OperationalMetrics {
  const filtered = events.filter((event) => {
    if (["RIDE_REQUEST_CREATED", "RIDE_OFFER_CREATED", "MATCH_CREATED", "RIDE_STARTED", "RIDE_COMPLETED", "RIDE_REPEATED"].includes(event.eventName) && !event.trustedSource) return false;
    if (filters.periodStart && event.createdAt < filters.periodStart) return false;
    if (filters.periodEnd && event.createdAt >= filters.periodEnd) return false;
    if (filters.source && event.source !== filters.source) return false;
    if (filters.campaign && event.campaign !== filters.campaign) return false;
    return ([
      ["origin", filters.origin], ["destination", filters.destination],
      ["timeWindow", filters.timeWindow], ["profile", filters.profile],
    ] as const).every(([field, expected]) => !expected || metadataValue(event, field) === expected.toLowerCase());
  });
  const creations = filtered.filter((event) => event.eventName === "RIDE_REQUEST_CREATED" || event.eventName === "RIDE_OFFER_CREATED");
  const uniqueCreations = [...new Map(creations.filter((event) => event.rideId).map((event) => [event.rideId!, event])).values()];
  const requests = uniqueCreations.filter((event) => event.eventName === "RIDE_REQUEST_CREATED");
  const offers = uniqueCreations.filter((event) => event.eventName === "RIDE_OFFER_CREATED");
  const matches = [...new Map(filtered.filter((event) => event.eventName === "MATCH_CREATED" && event.matchId).map((event) => [event.matchId!, event])).values()];
  const requestIds = new Set(requests.map((event) => event.rideId!));
  const offerIds = new Set(offers.map((event) => event.rideId!));
  const relatedId = (event: RideOperationalEvent, key: string, fallback: string) =>
    String(event.metadata?.[key] ?? event.metadata?.[fallback] ?? event.rideId ?? "");
  const matchedRequestIds = new Set(matches.map((event) => relatedId(event, "requestId", "requestRideId")).filter((id) => requestIds.has(id)));
  const utilizedOfferIds = new Set(matches.map((event) => relatedId(event, "offerId", "offerRideId")).filter((id) => offerIds.has(id)));
  const capacities = offers.map((event) => event.metadata?.availableSeats);
  const availableSeats = capacities.length && capacities.every((seats) => typeof seats === "number" && Number.isFinite(seats) && seats >= 0)
    ? (capacities as number[]).reduce((sum, seats) => sum + seats, 0) : null;
  const eligibleOfferMatches = matches.filter((event) => offerIds.has(relatedId(event, "offerId", "offerRideId")));
  const occupiedSeats = availableSeats === null ? null : eligibleOfferMatches.reduce((sum, event) => {
    const seats = event.metadata?.seatsOccupied ?? event.metadata?.passengerCount ?? 1;
    return sum + (typeof seats === "number" && Number.isFinite(seats) && seats > 0 ? seats : 1);
  }, 0);
  const requestTimes = new Map(requests.map((event) => [event.rideId!, Date.parse(event.createdAt)]));
  const matchDurations = matches.map((event) => {
    const requestId = relatedId(event, "requestId", "requestRideId");
    return Date.parse(event.createdAt) - (requestTimes.get(requestId) ?? Number.NaN);
  }).filter(Number.isFinite);
  return {
    request: { eligibleRequests: requests.length, matchedRequests: matchedRequestIds.size, unmatchedRequests: requests.length - matchedRequestIds.size, requestMatchRate: pct(matchedRequestIds.size, requests.length) },
    offer: { eligibleOffers: offers.length, utilizedOffers: utilizedOfferIds.size, unmatchedOffers: offers.length - utilizedOfferIds.size, offerMatchRate: pct(utilizedOfferIds.size, offers.length) },
    seats: { availableSeats, occupiedSeats, seatFillRate: availableSeats === null ? null : pct(occupiedSeats!, availableSeats) },
    match: {
      total: matches.length,
      averageMinutesToMatch: matchDurations.length ? Math.round(matchDurations.reduce((sum, ms) => sum + ms, 0) / matchDurations.length / 60000 * 100) / 100 : null,
      cancelled: matches.filter((event) => event.status === "cancelled").length,
      completed: new Set(filtered.filter((event) => event.eventName === "RIDE_COMPLETED" && event.rideId).map((event) => event.rideId)).size,
    },
  };
}

export async function getOperationalMetrics(filters: OperationalFilters = {}) {
  const { data, error } = await supabase.rpc("get_operational_metrics", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_profile: filters.profile ?? null,
    p_origin: filters.origin ?? null,
    p_destination: filters.destination ?? null,
    p_time_window: filters.timeWindow ?? null,
  });
  if (error) throw new Error(`NÃ£o foi possÃ­vel carregar indicadores operacionais: ${error.message}`);
  return data as OperationalMetrics;
}
