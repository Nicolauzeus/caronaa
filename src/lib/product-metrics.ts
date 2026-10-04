import type { ProductEventName } from "./product-events";

export type ProductMetricEvent = { eventName: ProductEventName; userId: string };
export type ProductMetricsSummary = Record<
  "registered" | "rideCreated" | "matched" | "rideCompleted" | "paid" | "repeated",
  number
> & { conversionToRide: number; conversionToRepeat: number };

const rate = (value: number, base: number) => (base ? Math.round((value / base) * 10000) / 100 : 0);

export function buildProductMetrics(events: ProductMetricEvent[]): ProductMetricsSummary {
  const users = (names: ProductEventName[]) => new Set(events.filter((event) => names.includes(event.eventName)).map((event) => event.userId)).size;
  const registered = users(["USER_REGISTERED"]);
  const rideCreated = users(["RIDE_REQUEST_CREATED", "RIDE_OFFER_CREATED"]);
  const matched = users(["MATCH_CREATED"]);
  const rideCompleted = users(["RIDE_COMPLETED"]);
  const paid = users(["PAYMENT_COMPLETED"]);
  const repeated = users(["RIDE_REPEATED"]);
  return { registered, rideCreated, matched, rideCompleted, paid, repeated, conversionToRide: rate(rideCreated, registered), conversionToRepeat: rate(repeated, rideCompleted) };
}
