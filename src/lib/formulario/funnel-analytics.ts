import { supabase } from "@/integrations/supabase/client";

export type FunnelEventName =
  | "landing_view"
  | "form_started"
  | "form_step_completed"
  | "form_completed"
  | "lead_created";

export type Attribution = {
  source: string;
  campaign: string | null;
  campaignEvent: string;
};

const SESSION_KEY = "caronaa-funnel-session-id";
const MAX_ATTRIBUTE_LENGTH = 100;

function sessionId() {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

function cleanAttribute(value: string | null, fallback: string | null = null) {
  const normalized = value?.trim().slice(0, MAX_ATTRIBUTE_LENGTH);
  return normalized || fallback;
}

export function getFormAttribution(): Attribution {
  const query = new URLSearchParams(window.location.search);

  return {
    // `src` is intentionally first-class so each printed QR code can be named explicitly.
    source: cleanAttribute(query.get("src") ?? query.get("utm_source"), "sts2026")!,
    campaign: cleanAttribute(query.get("campaign") ?? query.get("utm_campaign")),
    campaignEvent: "sts2026",
  };
}

export async function trackFunnelEvent({
  name,
  attribution,
  userId,
  step,
}: {
  name: FunnelEventName;
  attribution: Attribution;
  userId: string | null;
  step?: string;
}) {
  const anonymousSessionId = sessionId();
  const idempotencyKey = `${anonymousSessionId}:${name}:${step ?? ""}`;
  const { error } = await supabase.from("form_funnel_events").upsert(
    {
      event_name: name,
      event_step: step ?? null,
      anonymous_session_id: anonymousSessionId,
      user_id: userId,
      source: attribution.source,
      campaign: attribution.campaign,
      campaign_event: attribution.campaignEvent,
      idempotency_key: idempotencyKey,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );

  if (error) throw new Error(`Não foi possível registrar evento do funil: ${error.message}`);
}
