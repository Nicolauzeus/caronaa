import { supabase } from "@/integrations/supabase/client";
import { emptyTravelPreferences, travelPreferencesSchema, type TravelPreferences } from "./travel-preferences";

export async function loadTravelPreferences() {
  const { data, error } = await supabase.rpc("get_my_travel_preferences");
  if (error) throw new Error(error.message);
  const parsed = travelPreferencesSchema.safeParse(data);
  return parsed.success ? parsed.data : { ...emptyTravelPreferences };
}
export async function saveTravelPreferences(preferences: TravelPreferences, consent: boolean) {
  const { error } = await supabase.rpc("save_my_travel_preferences", {
    p_preferences: travelPreferencesSchema.parse(preferences), p_consent: consent,
  });
  if (error) throw new Error(error.message);
}