import { supabase } from "@/integrations/supabase/client";
import type { RideStatus } from "./ride-lifecycle";

export async function transitionRideStatus(rideId: string, nextStatus: RideStatus) {
  const { data, error } = await supabase.rpc("transition_ride_status", {
    p_ride_id: rideId,
    p_next_status: nextStatus,
  });
  if (error) {
    // Se a carona já estiver no estado solicitado (ex.: confirmação repetida ou concorrente),
    // trata de forma idempotente sem lançar erro para o usuário
    if (
      error.message?.includes(`Invalid ride transition: ${nextStatus} -> ${nextStatus}`) ||
      (nextStatus === "CONFIRMED" && error.message?.includes("CONFIRMED -> CONFIRMED"))
    ) {
      return nextStatus;
    }
    throw new Error(`Não foi possível atualizar o estado da carona: ${error.message}`);
  }
  return data;
}
