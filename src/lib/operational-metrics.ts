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
};

export type OperationalFilters = {
  periodStart?: string; periodEnd?: string; origin?: string; destination?: string;
  timeWindow?: string; profile?: string; source?: string; campaign?: string;
};

export type OperationalMetrics = {
  request: { eligible: number; served: number; unmatched: number; matchRate: number };
  offer: { eligible: number; utilized: number; unmatched: number; matchRate: number };
  seats: { available: number | null; occupied: number | null; fillRate: number | null };
  match: { total: number; averageMinutesToMatch: number | null; cancelled: number; completed: number };
};

const pct = (value: number, total: number) => total ? Math.round(value / total * 10000) / 100 : 0;
const value = (event: RideOperationalEvent, field: string) => String(event.metadata?.[field] ?? "").toLowerCase();

export function buildOperationalMetrics(events: RideOperationalEvent[], filters: OperationalFilters = {}): OperationalMetrics {
  const filtered = events.filter((event) => {
    const at = event.createdAt;
    if (filters.periodStart && at < filters.periodStart) return false;
    if (filters.periodEnd && at >= filters.periodEnd) return false;
    if (filters.source && event.source !== filters.source) return false;
    if (filters.campaign && event.campaign !== filters.campaign) return false;
    return ([['origin', filters.origin], ['destination', filters.destination], ['timeWindow', filters.timeWindow], ['profile', filters.profile]] as const)
      .every(([field, expected]) => !expected || value(event, field) === expected.toLowerCase());
  });
  const created = filtered.filter((e) => e.eventName === "RIDE_REQUEST_CREATED" || e.eventName === "RIDE_OFFER_CREATED");
  const rides = new Map(created.filter((e) => e.rideId).map((e) => [e.rideId!, e]));
  const requests = [...rides.values()].filter((e) => e.eventName === "RIDE_REQUEST_CREATED");
  const offers = [...rides.values()].filter((e) => e.eventName === "RIDE_OFFER_CREATED");
  const matches = filtered.filter((e) => e.eventName === "MATCH_CREATED" && e.matchId);
  const uniqueMatches = [...new Map(matches.map((e) => [e.matchId!, e])).values()];
  const requestIds = new Set(requests.flatMap((request) => request.rideId ? [request.rideId] : []));
  const offerIds = new Set(offers.flatMap((offer) => offer.rideId ? [offer.rideId] : []));
  const matchRideId = (match: RideOperationalEvent, kind: "request" | "offer") => {
    const metadataId = match.metadata?.[kind === "request" ? "requestRideId" : "offerRideId"];
    const candidate = typeof metadataId === "string" ? metadataId : match.rideId;
    return candidate ?? null;
  };
  const servedRequestIds = new Set(uniqueMatches.map((match) => matchRideId(match, "request")).filter((id): id is string => Boolean(id && requestIds.has(id))));
  const utilizedOfferIds = new Set(uniqueMatches.map((match) => matchRideId(match, "offer")).filter((id): id is string => Boolean(id && offerIds.has(id))));
  const seatValues = offers.map((offer) => offer.metadata?.availableSeats);
  const offeredSeats = seatValues.length > 0 && seatValues.every((seats) => typeof seats === "number" && Number.isFinite(seats) && seats >= 0)
    ? (seatValues as number[]).reduce((total, seats) => total + seats, 0)
    : null;
  const occupiedSeats = offeredSeats === null ? null : uniqueMatches.reduce((total, match) => {
    const seats = match.metadata?.seatsOccupied ?? match.metadata?.passengerCount ?? 1;
    return total + (typeof seats === "number" && Number.isFinite(seats) && seats > 0 ? seats : 1);
  }, 0);
  const timings = uniqueMatches.map((match) => {
    const ride = match.rideId ? rides.get(match.rideId) : undefined;
    return ride ? Date.parse(match.createdAt) - Date.parse(ride.createdAt) : NaN;
  }).filter(Number.isFinite);
  return {
    request: { eligible: requests.length, served: servedRequestIds.size, unmatched: requests.length - servedRequestIds.size, matchRate: pct(servedRequestIds.size, requests.length) },
    offer: { eligible: offers.length, utilized: utilizedOfferIds.size, unmatched: offers.length - utilizedOfferIds.size, matchRate: pct(utilizedOfferIds.size, offers.length) },
    seats: { available: offeredSeats, occupied: occupiedSeats, fillRate: offeredSeats === null ? null : pct(occupiedSeats!, offeredSeats) },
    match: { total: uniqueMatches.length, averageMinutesToMatch: timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length / 60000 * 100) / 100 : null, cancelled: uniqueMatches.filter((e) => e.status === "cancelled").length, completed: uniqueMatches.filter((e) => e.status === "completed").length },
  };
}

export async function getOperationalMetrics(filters: OperationalFilters = {}) {
  let query = supabase.from("product_events").select("*").in("event_name", [
    "RIDE_REQUEST_CREATED", "RIDE_OFFER_CREATED", "MATCH_CREATED", "RIDE_STARTED", "RIDE_COMPLETED",
  ]).order("created_at", { ascending: true });
  if (filters.periodStart) query = query.gte("created_at", filters.periodStart);
  if (filters.periodEnd) query = query.lt("created_at", filters.periodEnd);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.campaign) query = query.eq("campaign", filters.campaign);
  const { data, error } = await query;
  if (error) throw new Error(`Não foi possível carregar indicadores operacionais: ${error.message}`);
  return buildOperationalMetrics((data ?? []).map((event) => ({
    eventName: event.event_name, rideId: event.ride_id, matchId: event.match_id, status: event.status,
    createdAt: event.created_at, source: event.source, campaign: event.campaign,
    metadata: event.metadata as Record<string, unknown>,
  })), filters);
}
