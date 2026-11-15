import { supabase } from "@/integrations/supabase/client";

const ACTIVE_QUICK_RIDE_STATUSES=new Set([
  "SEARCHING","REQUESTED","PENDING","ACCEPTED","ARRIVED",
  "IN_PROGRESS","DRIVER_EN_ROUTE","EN_ROUTE","MATCHED","CONFIRMED",
]);
export type QuickRideGuardResult=
  {allowed:true}|{allowed:false;reason:"ACTIVE_RIDE"|"UNAVAILABLE"};

export function isQuickRideActive(status:unknown):boolean {
  return typeof status==="string" && ACTIVE_QUICK_RIDE_STATUSES.has(status.toUpperCase());
}

/**
 * Read-only F07 guard. Both passenger AND driver quick rides are considered.
 * Fail closed if the existing RPC is unavailable; never mutate the F07 system.
 */
export async function canSwitchCaronaaRole(
  operationalRide:{id:string;status:string}|null|undefined,
):Promise<QuickRideGuardResult> {
  // A mounted operational ride with any nonterminal/unknown status blocks
  // switching, even if its status isn't listed in the known F07 enum.
  if(operationalRide && !new Set(["COMPLETED","CANCELLED","CANCELED","EXPIRED","REJECTED","FINISHED"])
    .has(operationalRide.status.toUpperCase()))
    return {allowed:false,reason:"ACTIVE_RIDE"};
  try {
    const {data,error}=await (supabase as any).rpc("quick_ride_my_requests");
    if(error || !Array.isArray(data))return {allowed:false,reason:"UNAVAILABLE"};
    if(data.some((ride:unknown)=>
      ride!==null && typeof ride==="object" &&
      isQuickRideActive((ride as {status?:unknown}).status)))
      return {allowed:false,reason:"ACTIVE_RIDE"};
    return {allowed:true};
  }catch{
    return {allowed:false,reason:"UNAVAILABLE"};
  }
}
