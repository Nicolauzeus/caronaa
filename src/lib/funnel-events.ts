import { supabase } from "@/integrations/supabase/client";
import type { Enums, TablesInsert } from "@/integrations/supabase/types";

const ANONYMOUS_SESSION_KEY = "caronaa-anonymous-session-id";
const DEFAULT_SOURCE = "sts2026";
const DEFAULT_CAMPAIGN_EVENT = "Siará Tech Summit 2026";
const ATTRIBUTION_STORAGE_PREFIX = "caronaa-campaign-attribution";
const MAX_ATTRIBUTE_LENGTH = 120;

export type FunnelEventName = Enums<"funnel_event_name">;
export type ClientFunnelEventName =
  | "landing_view"
  | "form_started"
  | "form_step_completed"
  | "form_role_selected"
  | "form_route_started"
  | "form_route_completed"
  | "form_event_presence_completed"
  | "form_driver_interest"
  | "form_driver_vehicle_selected"
  | "form_driver_seats_selected"
  | "form_price_input"
  | "form_passenger_interest"
  | "form_passenger_transport_selected";

export type CampaignAttribution = {
  source: string;
  campaign: string | null;
  campaignEvent: string;
};

export type TrackFunnelEventInput = CampaignAttribution & {
  eventName: ClientFunnelEventName;
  userId?: string | null;
  formStep?: string | null;
  submissionId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

type FunnelEventInsert = TablesInsert<"funnel_events">;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function eventDeduplicationKey(
  input: Pick<
    TrackFunnelEventInput,
    "eventName" | "source" | "campaign" | "campaignEvent" | "formStep" | "submissionId"
  >,
) {
  const scope = input.submissionId
    ? `submission:${input.submissionId}`
    : input.formStep
      ? `step:${input.formStep}`
      : "session";

  return [
    "caronaa-funnel-event",
    input.eventName,
    input.source,
    input.campaign ?? "",
    input.campaignEvent,
    scope,
  ].join(":");
}

function createAnonymousSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getAnonymousSessionId(): string | null {
  if (!canUseBrowserStorage()) return null;

  const existing = window.localStorage.getItem(ANONYMOUS_SESSION_KEY);

  if (existing) return existing;

  const sessionId = createAnonymousSessionId();
  window.localStorage.setItem(ANONYMOUS_SESSION_KEY, sessionId);

  return sessionId;
}

function cleanAttributionValue(value: string | null) {
  // eslint-disable-next-line no-control-regex
  const normalized = value?.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return normalized ? normalized.slice(0, MAX_ATTRIBUTE_LENGTH) : null;
}

function attributionStorageKey(defaultCampaignEvent: string) {
  return `${ATTRIBUTION_STORAGE_PREFIX}:${defaultCampaignEvent}`;
}

function readStoredAttribution(defaultCampaignEvent: string): CampaignAttribution | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(attributionStorageKey(defaultCampaignEvent)) ?? "null",
    ) as Partial<CampaignAttribution> | null;
    const source = cleanAttributionValue(parsed?.source ?? null);
    const campaignEvent = cleanAttributionValue(parsed?.campaignEvent ?? null);

    return source && campaignEvent
      ? { source, campaign: cleanAttributionValue(parsed?.campaign ?? null), campaignEvent }
      : null;
  } catch {
    return null;
  }
}

function persistAttribution(attribution: CampaignAttribution, defaultCampaignEvent: string) {
  if (!canUseBrowserStorage()) return;
  window.sessionStorage.setItem(
    attributionStorageKey(defaultCampaignEvent),
    JSON.stringify(attribution),
  );
}

export function getCampaignAttribution({
  defaultSource = DEFAULT_SOURCE,
  defaultCampaignEvent = DEFAULT_CAMPAIGN_EVENT,
}: {
  defaultSource?: string;
  defaultCampaignEvent?: string;
} = {}): CampaignAttribution {
  if (typeof window === "undefined") {
    return {
      source: defaultSource,
      campaign: null,
      campaignEvent: defaultCampaignEvent,
    };
  }

  const search = new URLSearchParams(window.location.search);
  const sourceFromQuery =
    cleanAttributionValue(search.get("src")) ??
    cleanAttributionValue(search.get("source")) ??
    cleanAttributionValue(search.get("utm_source"));
  const campaignFromQuery =
    cleanAttributionValue(search.get("campaign")) ??
    cleanAttributionValue(search.get("utm_campaign"));
  const eventFromQuery =
    cleanAttributionValue(search.get("event")) ??
    cleanAttributionValue(search.get("campaign_event"));
  const stored =
    !sourceFromQuery && !campaignFromQuery && !eventFromQuery
      ? readStoredAttribution(defaultCampaignEvent)
      : null;

  const attribution = {
    source: sourceFromQuery ?? stored?.source ?? defaultSource,
    campaign: campaignFromQuery ?? stored?.campaign ?? null,
    campaignEvent: eventFromQuery ?? stored?.campaignEvent ?? defaultCampaignEvent,
  };

  persistAttribution(attribution, defaultCampaignEvent);

  return attribution;
}

export function getDeviceCategory(): "mobile" | "tablet" | "desktop" | null {
  if (typeof window === "undefined") return null;

  const width = window.innerWidth;

  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export async function trackFunnelEvent({
  eventName,
  userId = null,
  source,
  campaign,
  campaignEvent,
  formStep = null,
  submissionId = null,
  metadata = {},
}: TrackFunnelEventInput) {
  const anonymousSessionId = userId ? null : getAnonymousSessionId();

  if (!userId && !anonymousSessionId) return;

  const deduplicationKey = eventDeduplicationKey({
    eventName,
    source,
    campaign,
    campaignEvent,
    formStep,
    submissionId,
  });

  if (canUseBrowserStorage()) {
    if (window.localStorage.getItem(deduplicationKey) === "1") return;
    window.localStorage.setItem(deduplicationKey, "1");
  }

  const isStandardDbEvent = (
    name: string,
  ): name is
    "landing_view" | "form_started" | "form_step_completed" | "form_completed" | "lead_created" => {
    return [
      "landing_view",
      "form_started",
      "form_step_completed",
      "form_completed",
      "lead_created",
    ].includes(name);
  };

  const row: FunnelEventInsert = {
    event_name: isStandardDbEvent(eventName) ? eventName : "form_step_completed",
    anonymous_session_id: anonymousSessionId,
    user_id: userId,
    source,
    campaign,
    campaign_event: campaignEvent,
    form_step: formStep,
    submission_id: submissionId,
    device_category: getDeviceCategory(),
    metadata: {
      ...metadata,
      clientEventName: eventName,
    },
  };

  const { error } = await supabase.from("funnel_events").insert(row);

  if (error && error.code !== "23505") {
    if (canUseBrowserStorage()) window.localStorage.removeItem(deduplicationKey);
    console.warn(`[Funnel] ${eventName} not recorded: ${error.message}`);
  }
}
