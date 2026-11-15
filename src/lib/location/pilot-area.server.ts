import { matchPilotArea, type PilotArea, type PilotAreaMatch } from "./pilot-area";

let cached: { at: number; areas: PilotArea[] } | null = null;

async function activeAreas(): Promise<PilotArea[]> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.areas;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).from("pilot_areas")
    .select("municipality,state,region,center_lat,center_lng,radius_km").eq("active", true);
  if (error) throw new Error("PILOT_AREAS_UNAVAILABLE");
  cached = { at: Date.now(), areas: (data ?? []) as PilotArea[] };
  return cached.areas;
}

/** Single municipality resolver for driver radar and passenger coverage. No Google. */
export async function resolvePilotArea(lat: number, lng: number): Promise<PilotAreaMatch | null> {
  return matchPilotArea(lat, lng, await activeAreas());
}

/** Adapter with the civic shape used by existing gates. */
export async function resolvePilotCivic(lat: number, lng: number) {
  const m = await resolvePilotArea(lat, lng);
  return m ? { city: m.municipality, state: m.state, country: "BR", lat, lng, rawText: m.municipality } : null;
}
