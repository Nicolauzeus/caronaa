import { supabase } from "@/integrations/supabase/client";
import type { RideStatus } from "./ride-lifecycle";

export async function transitionRideStatus(rideId: string, nextStatus: RideStatus) {
  const { data, error } = await supabase.rpc("transition_ride_status", {
    p_ride_id: rideId,
    p_next_status: nextStatus,
  });
  if (error) throw new Error(`NÃ£o foi possÃ­vel atualizar o estado da carona: ${error.message}`);
  return data;
}
