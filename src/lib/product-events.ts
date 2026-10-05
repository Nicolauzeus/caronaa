import { supabase } from "@/integrations/supabase/client";
import { getCampaignAttribution } from "@/lib/funnel-events";

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
export const clientProductEventNames = productEventNames.filter(
  (eventName): eventName is Exclude<ProductEventName, "RIDE_REQUEST_CREATED" | "RIDE_OFFER_CREATED" | "MATCH_CREATED" | "RIDE_STARTED" | "RIDE_COMPLETED" | "PAYMENT_COMPLETED" | "RIDE_REPEATED"> =>
    !["RIDE_REQUEST_CREATED", "RIDE_OFFER_CREATED", "MATCH_CREATED", "RIDE_STARTED", "RIDE_COMPLETED", "PAYMENT_COMPLETED", "RIDE_REPEATED"].includes(eventName),
);

export type ProductEventInput = {
  eventName: (typeof clientProductEventNames)[number];
  userId: string;
  rideId?: string | null;
  matchId?: string | null;
  status?: string | null;
  source?: string | null;
  campaign?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function trackProductEvent(input: ProductEventInput) {
  const attribution = getCampaignAttribution({ defaultSource: "direct" });
  const { error } = await supabase.from("product_events").insert({
    event_name: input.eventName,
    user_id: input.userId,
    ride_id: input.rideId ?? null,
    match_id: input.matchId ?? null,
    status: input.status ?? null,
    source: input.source ?? attribution.source,
    campaign: input.campaign ?? attribution.campaign,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`Não foi possível registrar evento de produto: ${error.message}`);
}

export function productEventForRide(kind: "offer" | "request", isRepeat: boolean) {
  if (isRepeat) return "RIDE_REPEATED" as const;
  return kind === "offer" ? ("RIDE_OFFER_CREATED" as const) : ("RIDE_REQUEST_CREATED" as const);
}
