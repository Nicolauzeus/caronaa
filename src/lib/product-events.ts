// Product events are business facts produced by trusted backend/database paths.
// Client-side page and form telemetry belongs in funnel-events.ts instead.
export const productEventNames = [
  "USER_REGISTERED",
  "RIDE_REQUEST_CREATED",
  "RIDE_OFFER_CREATED",
  "MATCH_CREATED",
  "RIDE_STARTED",
  "RIDE_COMPLETED",
  "PAYMENT_COMPLETED",
  "RIDE_REPEATED",
] as const;

export type ProductEventName = (typeof productEventNames)[number];

export function productEventForRide(kind: "offer" | "request", isRepeat: boolean) {
  if (isRepeat) return "RIDE_REPEATED" as const;
  return kind === "offer" ? ("RIDE_OFFER_CREATED" as const) : ("RIDE_REQUEST_CREATED" as const);
}
