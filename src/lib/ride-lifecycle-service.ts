import { supabase } from "@/integrations/supabase/client";
import type { RideStatus } from "./ride-lifecycle";

export async function transitionRideStatus(rideId: string, nextStatus: RideStatus) {
  if (nextStatus === "IN_PROGRESS")
    throw new Error("Valide o PIN de embarque para iniciar a viagem.");
  const { data, error } = await supabase.rpc("transition_ride_status", {
    p_ride_id: rideId,
    p_next_status: nextStatus,
  });
  if (error) {
    throw new Error(`Não foi possível atualizar o estado da carona: ${error.message}`);
  }
  return data;
}
